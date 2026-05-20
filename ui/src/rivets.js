// Thin wrapper so rivets can be mocked in Jest tests (window.rivets set by CDN script)
const rivets = (typeof window !== 'undefined') ? window.rivets : null;
export default rivets;
