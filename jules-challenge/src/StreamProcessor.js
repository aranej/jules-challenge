// Základný skeleton pre Stream Processor (Node.js)

class StreamProcessor {
  constructor() {
    this.buffer = [];
    this.windowSize = 5 * 60 * 1000; // 5 min v milisekundách
    this.isProcessing = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000;
    
    // Circuit breaker state
    this.failureCount = 0;
    this.failureThreshold = 3; // Number of failures to open the circuit
    this.resetTimeout = 30000; // Time in ms to wait before attempting to reset (go to Half-Open)
    this.circuitOpen = false;
    this.halfOpen = false; // True if circuit is in Half-Open state
    this.processingTrialEvent = false; // True if a trial event is currently being processed in Half-Open state

    // Store for processed events
    this.processedEvents = [];

    // Enhanced Buffering Properties
    this.manualBufferingActive = false;
    this.maxBufferSize = 1000; // Default max buffer size
    // TODO: Consider persisting buffer to disk/DB if events are critical and outages are long (e.g., on startup, load from persistent store)
  }

  // --- Enhanced Buffering Control ---
  startBuffering() {
    this.manualBufferingActive = true;
    console.log('Manual buffering started.');
  }

  stopBufferingAndProcess() {
    if (!this.manualBufferingActive) {
      console.log('Manual buffering was not active. No action taken.');
      return;
    }

    this.manualBufferingActive = false;
    console.log('Manual buffering stopped. Processing buffered events...');
    
    const eventsToProcess = [...this.buffer]; // Create a copy to process
    this.buffer = []; // Clear the main buffer immediately

    console.log(`Processing ${eventsToProcess.length} events from manual buffer.`);
    eventsToProcess.forEach(event => {
      // processEvent will handle its own logic, including circuit breaker checks
      // This means if circuit is open, events might be re-buffered, which is fine.
      this.processEvent(event); 
    });
    console.log('Finished processing events from manual buffer.');
  }
  
  // Prijíma event data do bufferu
  processEvent(event) {
    // --- Buffering Logic ---
    // 1. If a trial event is already being processed in Half-Open state, buffer subsequent events.
    if (this.processingTrialEvent) {
      console.log('Circuit Breaker: Trial event in progress, buffering event:', JSON.stringify(event));
      this.pushToBuffer(event);
      return;
    }

    // 2. If circuit is Open (and not Half-Open, though halfOpen implies circuitOpen is false for the trial)
    if (this.circuitOpen) {
      console.log('Circuit Breaker: Open, buffering event:', JSON.stringify(event));
      this.pushToBuffer(event);
      return;
    }

    // 3. If manual buffering is active
    if (this.manualBufferingActive) {
      console.log('Manual buffering active, buffering event:', JSON.stringify(event));
      this.pushToBuffer(event);
      return;
    }

    // --- Processing Logic (Closed or Half-Open Trial) ---
    let isTrial = this.halfOpen; // Check if this will be a trial event

    if (isTrial) {
      this.processingTrialEvent = true; // Mark that a trial is starting
      // this.halfOpen = false; // No, keep halfOpen true until success/failure of trial is known
      console.log('Circuit Breaker: Half-Open - Attempting trial event:', JSON.stringify(event));
    }

    try {
      // Actual event processing (validation, transformation)
      if (!event || typeof event.id === 'undefined' || typeof event.timestamp === 'undefined' || typeof event.value === 'undefined' || typeof event.type === 'undefined') {
        const validationError = new Error(`Invalid event structure: Missing required properties. Event: ${JSON.stringify(event)}`);
        this.handleProcessingError(validationError, isTrial);
        return;
      }
      if (typeof event.id !== 'string' && typeof event.id !== 'number') {
        const typeError = new Error(`Invalid event type for id: Expected string or number, got ${typeof event.id}. Event: ${JSON.stringify(event)}`);
        this.handleProcessingError(typeError, isTrial);
        return;
      }
      if (typeof event.timestamp !== 'number' && (typeof event.timestamp !== 'string' || isNaN(new Date(event.timestamp).getTime()))) {
        const typeError = new Error(`Invalid event type for timestamp: Expected number or valid date string, got ${typeof event.timestamp}. Event: ${JSON.stringify(event)}`);
        this.handleProcessingError(typeError, isTrial);
        return;
      }
      if (typeof event.value !== 'number') {
        const typeError = new Error(`Invalid event type for value: Expected number, got ${typeof event.value}. Event: ${JSON.stringify(event)}`);
        this.handleProcessingError(typeError, isTrial);
        return;
      }
      if (typeof event.type !== 'string') {
        const typeError = new Error(`Invalid event type for type: Expected string, got ${typeof event.type}. Event: ${JSON.stringify(event)}`);
        this.handleProcessingError(typeError, isTrial);
        return;
      }

      const processedEvent = {
        ...event,
        processedAt: new Date().toISOString(),
        timestamp: typeof event.timestamp === 'number' ? new Date(event.timestamp).toISOString() : event.timestamp
      };
      
      this.processedEvents.push(processedEvent);
      console.log(`Event processed and stored: ${processedEvent.id}, Total processed: ${this.processedEvents.length}`);
      
      // --- Success Handling ---
      if (isTrial) {
        console.log('Circuit Breaker: Half-Open - Trial event Succeeded.');
        this.resetCircuitAndProcessBuffer(); // Transition to Closed
      } else {
        this.failureCount = 0; // Reset failure count on normal success in Closed state
      }
      
    } catch (error) { // Catch any unexpected errors during the core processing
      this.handleProcessingError(error, isTrial);
    } finally {
      if (isTrial) {
        this.processingTrialEvent = false; // Trial attempt is finished
      }
    }
  }

  // Helper to push to buffer with overflow check
  pushToBuffer(event) {
    if (this.buffer.length >= this.maxBufferSize) {
      const discardedEvent = this.buffer.shift();
      console.warn(`Buffer full (max size ${this.maxBufferSize}). Discarded oldest event:`, JSON.stringify(discardedEvent));
      // TODO: Consider persisting buffer to disk/DB if events are critical
    }
    this.buffer.push(event);
  }

  // Centralized handling of errors from processEvent's try block
  handleProcessingError(error, isTrialAttempt) {
    console.error(`Error during event processing: ${error.message}`, isTrialAttempt ? "(Trial Event)" : "");
    if (isTrialAttempt) {
      console.log('Circuit Breaker: Half-Open - Trial event Failed.');
      this.openCircuit(); // Re-open the circuit immediately
    } else {
      this.handleError(error); // Normal error handling for Closed state
    }
  }
  
  // Agreguje dáta v rolling window
  aggregateData() {
    const now = Date.now();
    const windowStart = now - this.windowSize;

    // Filter events from this.processedEvents that fall within the current rolling window
    // Ensure event.timestamp is comparable (epoch milliseconds)
    const windowData = this.processedEvents.filter(event => {
      const eventTimestamp = new Date(event.timestamp).getTime(); // Convert ISO string to epoch ms
      return eventTimestamp >= windowStart && eventTimestamp <= now;
    });

    // Perform aggregations
    const count = windowData.length;
    let sumValue = 0;
    const typesCount = {};

    for (const event of windowData) {
      sumValue += event.value;
      typesCount[event.type] = (typesCount[event.type] || 0) + 1;
    }

    const averageValue = count > 0 ? sumValue / count : 0;

    // Spracuj dáta v okne a vráť agregované výsledky
    const aggregatedMetrics = {
      windowStartTime: new Date(windowStart).toISOString(),
      windowEndTime: new Date(now).toISOString(),
      count: count,
      sumValue: sumValue,
      averageValue: averageValue,
      typesCount: typesCount,
      // Ďalšie agregované metriky môžu byť pridané tu
    };
    
    console.log(`Aggregated data over ${this.windowSize/1000/60} min window:`, JSON.stringify(aggregatedMetrics));

    // Clean up old events from this.processedEvents
    // Remove events that are older than windowStart
    this.processedEvents = this.processedEvents.filter(event => {
      const eventTimestamp = new Date(event.timestamp).getTime();
      return eventTimestamp >= windowStart;
    });
    console.log(`Cleaned old events. Current processedEvents count: ${this.processedEvents.length}`);

    return aggregatedMetrics;
  }
  
  // Error handling for Closed state leading to Open state
  handleError(error) { // This is called from handleProcessingError if not a trial
    this.failureCount++;
    console.error(`Processing error in Closed state (${this.failureCount}/${this.failureThreshold}): ${error.message}`);
    
    if (!this.circuitOpen && this.failureCount >= this.failureThreshold) {
      this.openCircuit();
    }
  }
  
  // Otvorí circuit breaker: Closed -> Open
  openCircuit() {
    if (this.circuitOpen && !this.halfOpen) return; // Already fully open, or transitioning from half-open failure

    console.log(`Circuit Breaker: Transitioning to Open. Failures: ${this.failureCount}`);
    this.circuitOpen = true;
    this.halfOpen = false; // Ensure it's not in half-open when explicitly opened or re-opened
    
    // Schedule transition to Half-Open state
    setTimeout(() => {
      this.setHalfOpenState();
    }, this.resetTimeout);
  }

  // Prejde do Half-Open stavu: Open -> Half-Open
  setHalfOpenState() {
    // Only transition if still open; might have been manually reset or changed
    if (this.circuitOpen && !this.halfOpen) { 
      this.circuitOpen = false; // Allow next event as a trial
      this.halfOpen = true;
      this.processingTrialEvent = false; // Reset this flag just in case
      console.log('Circuit Breaker: Open -> Half-Open. Ready for a trial event.');
    }
  }
  
  // Zatvorí circuit breaker po úspešnom Half-Open pokuse: Half-Open -> Closed
  resetCircuitAndProcessBuffer() {
    console.log('Circuit Breaker: Half-Open -> Closed. Resuming normal operation.');
    this.circuitOpen = false;
    this.halfOpen = false;
    this.failureCount = 0;
    this.processingTrialEvent = false;
    
    // Process buffered events
    const eventsToProcess = [...this.buffer];
    this.buffer = [];
    console.log(`Processing ${eventsToProcess.length} events from buffer after circuit closed.`);
    eventsToProcess.forEach(event => this.processEvent(event));
  }
  
  // Retry mechanism pre pripojenie (unrelated to circuit breaker logic for event processing)
  async connectWithRetry(connectFn) {
    try {
      await connectFn();
      this.retryCount = 0;
    } catch (error) {
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Connection attempt ${this.retryCount}/${this.maxRetries} failed, retrying in ${this.retryDelay}ms`);
        
        setTimeout(() => {
          this.connectWithRetry(connectFn);
        }, this.retryDelay * this.retryCount); // Exponential backoff
      } else {
        console.error('Max retries reached, giving up', error);
        throw error;
      }
    }
  }
}

module.exports = StreamProcessor;