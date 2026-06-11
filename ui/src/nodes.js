export const NODES = [
  {
    id: 'btc-regtest',
    label: 'Bitcoin Core',
    chain: 'BTC',
    network: 'regtest',
    chainIcon: 'currency_bitcoin',
  },
  {
    id: 'tron-node-1',
    label: 'TRON FullNode 1',
    chain: 'TRON',
    network: 'private',
    chainIcon: 'hexagon',
  },
  {
    id: 'tron-node-2',
    label: 'TRON FullNode 2',
    chain: 'TRON',
    network: 'private',
    chainIcon: 'hexagon',
  },
];

export function getNode(id) {
  return NODES.find(n => n.id === id) || null;
}
