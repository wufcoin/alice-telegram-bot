// Installation: npm install alchemy-sdk
const { Alchemy, Network, AlchemySubscription } = require("alchemy-sdk");

const settings = {
  apiKey: "-mPgekWTrv10mcTGP94CTyoFJylnHv_1", // Replace with your Alchemy API Key
  network: Network.ETH_MAINNET, // Replace with your network
};

const alchemy = new Alchemy(settings);

// Subscription for Alchemy's pendingTransactions API
alchemy.ws.on(
  {
    method: AlchemySubscription.PENDING_TRANSACTIONS,
  },
  (tx) => {console.log("dd")}
);