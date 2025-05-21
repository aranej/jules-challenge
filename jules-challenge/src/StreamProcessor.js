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
    this.failureThreshold = 3;
    this.resetTimeout = 30000;
    this.circuitOpen = false;
  }
  
  // Prijíma event data do bufferu
  processEvent(event) {
    if (this.circuitOpen) {
      console.log('Circuit breaker open, buffering event');
      this.buffer.push(event);
      return;
    }
    
    try {
      // TODO: Implementovať real spracovanie dát
      console.log('Processing event:', event);
      
      // Reset failure count on successful processing
      this.failureCount = 0;
    } catch (error) {
      this.handleError(error);
    }
  }
  
  // Agreguje dáta v rolling window
  aggregateData() {
    // TODO: Implementovať aggregation logic
    const now = Date.now();
    const windowStart = now - this.windowSize;
    
    // Filter dáta v aktuálnom okne
    const windowData = this.buffer.filter(event => event.timestamp >= windowStart);
    
    // TODO: Spracuj dáta v okne a vráť agregované výsledky
    return {
      count: windowData.length,
      // Ďalšie agregované metriky
    };
  }
  
  // Error handling s circuit breaker pattern
  handleError(error) {
    this.failureCount++;
    console.error(`Processing error (${this.failureCount}/${this.failureThreshold}):`, error);
    
    if (this.failureCount >= this.failureThreshold) {
      this.openCircuit();
    }
  }
  
  // Otvorí circuit breaker
  openCircuit() {
    console.log('Opening circuit breaker');
    this.circuitOpen = true;
    
    // Auto reset po timeout
    setTimeout(() => {
      this.closeCircuit();
    }, this.resetTimeout);
  }
  
  // Zatvorí circuit breaker
  closeCircuit() {
    console.log('Closing circuit breaker, processing buffered events');
    this.circuitOpen = false;
    this.failureCount = 0;
    
    // Process buffered events
    const bufferedEvents = [...this.buffer];
    this.buffer = [];
    
    bufferedEvents.forEach(event => this.processEvent(event));
  }
  
  // Retry mechanism pre pripojenie
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