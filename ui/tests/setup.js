// jsdom global setup — runs before every test suite via setupFiles
// beforeEach/afterEach are NOT available here (framework not installed yet)

// Mock window.rivets (normally loaded via CDN <script> tag in browser)
global.window = global.window || global;
global.window.rivets = {
  bind: jest.fn(() => ({ unbind: jest.fn() })),
  components: {},
  formatters: {},
};
