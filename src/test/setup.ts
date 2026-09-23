// Global Jest setup for React Native & Expo testing
class MockWebSocket {
  public onopen = null;
  public onclose = null;
  public onmessage = null;
  public onerror = null;
  public close() {}
  public send() {}
}

const globalObject = globalThis as unknown as { WebSocket?: unknown };
if (!globalObject.WebSocket) {
  globalObject.WebSocket = MockWebSocket;
}
