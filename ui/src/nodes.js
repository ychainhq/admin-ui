export const NODES = [
  {
    id: 'btc-regtest',
    label: 'Bitcoin Core',
    chain: 'BTC',
    network: 'regtest',
    chainIcon: 'currency_bitcoin',
  },
];

export function getNode(id) {
  return NODES.find(n => n.id === id) || null;
}
