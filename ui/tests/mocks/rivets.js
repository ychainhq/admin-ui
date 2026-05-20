// Jest module mock for src/rivets.js
const binding = { unbind: jest.fn() };
const rivets = {
  bind: jest.fn(() => binding),
  components: {},
  formatters: {},
};
export default rivets;
