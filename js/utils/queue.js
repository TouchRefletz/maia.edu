export class AsyncQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    this.drainResolvers = [];
  }

  enqueue(task) {
    this.queue.push(task);
    this.process();
  }

  async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      if (this.running === 0 && this.queue.length === 0) {
        this.emitDrain();
      }
      return;
    }

    this.running++;
    const task = this.queue.shift();

    try {
      await task();
    } catch (error) {
      console.error('Queue task failed:', error);
    } finally {
      this.running--;
      this.process();
    }
  }

  async drain() {
    if (this.running === 0 && this.queue.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.drainResolvers.push(resolve));
  }

  emitDrain() {
    this.drainResolvers.forEach((resolve) => resolve());
    this.drainResolvers = [];
  }
}
