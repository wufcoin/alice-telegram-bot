const { Network, Alchemy } = require("alchemy-sdk");
const fs = require("fs");
const axios = require("axios");
require('dotenv').config();
const Web3 = require("web3");
const TelegramBot = require('node-telegram-bot-api');
const ABI = require("./database/ERC20.json");
const contractPath = "./database/contracts.json";
const blockNumPath = "./database/blocknum.json";
const bot = new TelegramBot(process.env.token, { polling: true });
const checkContractPath = "./database/checkContracts.json";
const uniswapV2FactoryABI = require('./database/uniswapV2FactoryABI.json');
const uniswapV2PairABI = require('./database/uniswapV2pairABI.json');

bot.on('message', (msg) => {
    console.log("msg", msg.chat.id);
    if (msg.chat.id != process.env.chat_id) {
        bot.sendMessage(msg.chat.id, "You can't access in this channel!");
    }

});

let startState = false;
let checkLiquidity = false;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const settings = {
    apiKey: process.env.alchemyKey, // Replace with your Alchemy API Key
    network: Network.ETH_MAINNET, // Replace with your network
};

const ALCHEMY_URL = `https://eth-mainnet.g.alchemy.com/v2/${process.env.alchemyKey}`

const alchemy = new Alchemy(settings);
const web3 = new Web3(ALCHEMY_URL);
const factoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const getNewContracts = async () => {
    let savedBlockNum;
    let contractsInfo = [];
    try {
        const currentBlockNum = await alchemy.core.getBlockNumber();
        if (startState === false) {
            savedBlockNum = currentBlockNum;
            startState = true;
        } else {
            const savedBlockNumJson = fs.readFileSync(blockNumPath, "utf-8");
            if (savedBlockNumJson) {
                savedBlockNum = JSON.parse(savedBlockNumJson).block;
            } else {
                savedBlockNum = currentBlockNum;
            }
        }
        fs.writeFileSync(
            blockNumPath,
            JSON.stringify({ block: currentBlockNum }, null, "\t")
        );
        for (let i = savedBlockNum; i < currentBlockNum; i++) {

            // fs.writeFileSync(blockNumPath, JSON.stringify({ block: i }, null, "\t"));
            let block = await alchemy.core.getBlockWithTransactions(i);
            let blockTxs = block.transactions;
            // console.log(blockTxs)
            for (const tx of blockTxs) {
                let isContractDeployment = tx.to === null;
                let decimals = 0;
                let newContract = {};
                if (isContractDeployment) {
                    const sendContract = new web3.eth.Contract(ABI, tx.creates);
                    // console.log("tx.creates")
                    try {
                        decimals = await sendContract.methods.decimals().call();
                    } catch (err) {
                        console.log(tx.creates, "not ERC20 contract");
                    } finally {
                        if (decimals > 0) {
                            console.log(tx.creates, "New added address!")
                            newContract.address = tx.creates;
                            newContract.block = tx.blockNumber;
                            newContract.blockTime = Date.now();
                            newContract.from = tx.from;
                            contractsInfo.push(newContract);
                        }
                    }
                }
            }
        }

        let prevContractsJson = fs.readFileSync(contractPath, "utf-8");
        let allContracts;
        if (prevContractsJson) {
            const prevContracts = JSON.parse(fs.readFileSync(contractPath, "utf-8"));
            allContracts = prevContracts.concat(contractsInfo);
        } else {
            allContracts = contractsInfo;
        }

        fs.writeFileSync(contractPath, JSON.stringify(allContracts, null, "\t"));
    } catch (err) {
        console.log(err);
    }
}

const getCheckLiquidity = async () => {

    try {
        if (checkLiquidity === false) {
            const contractData = fs.readFileSync(contractPath, "utf-8");
            let checkContracts;
            if (contractData) {
                checkContracts = JSON.parse(contractData);
            }
            checkLiquidity = true;
            if (checkContracts.length > 0) {
                let check = [];
                for (let i = 0; i < checkContracts.length; i++) {
                    const factory = new web3.eth.Contract(uniswapV2FactoryABI, factoryAddress);
                    const pairAddress = await factory.methods.getPair(checkContracts[i].address, WETH).call();
                    if (pairAddress !== '0x0000000000000000000000000000000000000000') {
                        console.log('Liquidity exists for the ERC20 token.');
                        console.log('Uniswap Pair Address:', pairAddress);
                        const pair = new web3.eth.Contract(uniswapV2PairABI, pairAddress);
                        const reserves = await pair.methods.getReserves().call();
                        const token1Reserve = reserves._reserve0;
                        const token2Reserve = reserves._reserve1;
                        console.log(token1Reserve, token2Reserve, "reserve")
                        if (token1Reserve > 0 && token2Reserve > 0) {
                            console.log('Trading is active for the Uniswap pair.');
                            if (process.env.check_block == 0) {
                                const metadata = await alchemy.core.getTokenMetadata(checkContracts[i].address);
                                console.log(metadata, metadata);
                                // const honeypot = await axios.get(`https://api.honeypot.is/v2/IsHoneypot`, {
                                //     params: {
                                //         address: checkContracts[i].address,
                                //         pair: pairAddress
                                //     }
                                // });
                                // const honeypotData = honeypot.data;
                                // console.log(honeypot.data)
                                // // const inputString = `` TX: ${tx}   P: ${p}          ALPHA : ${alpha}     SNIPER : ${sniper}
                                // const message = `Token: ${honeypotData?.token?.name} (${honeypotData?.token?.symbol}) | $ ${honeypotData?.pair?.liquidity.toFixed(1)}\nContract Address: <code>${checkContracts[i].address}</code>\n`
                                //     + `Tax: ${honeypotData?.simulationResult?.buyTax}/${honeypotData.simulationResult?.sellTax}\nMax: ${100}\n`
                                //     + `<a href="https://www.dextools.io/app/en/ether/pair-explorer/${checkContracts[i].address}">DexTools</a> | <a href="https://t.me/MaestroProBot?start=${checkContracts[i].address}">Maestro</a> | <a href="https://etherscan.io/address/${checkContracts[i].address}">Etherscan</a>`;
                                // bot.sendMessage(process.env.chat_id, message, { parse_mode: 'HTML', disable_web_page_preview: true });
                                check.push(i);
                            } else {
                                const checkContractData = fs.readFileSync(checkContractPath, "utf-8");
                                let checkedContracts = [];
                                if (checkContractData) {
                                    checkedContracts = JSON.parse(checkContractData);
                                }
                                const checkData = checkContracts[i];
                                checkData.pairAddress = pairAddress;
                                checkedContracts.push(checkContracts[i]);
                                console.log('saved checkcontracts', checkContracts[i].address)
                                fs.writeFileSync(checkContractPath, JSON.stringify(checkedContracts, null, "\t"));
                                check.push(i);
                            }

                        } else {
                            if (Number(Date.now()) - Number(checkContracts[i].blockTime) > process.env.check_time * 1000) {
                                check.push(i);
                            } else {
                                console.log('Trading is not active for the Uniswap pair.');
                            }

                        }
                    } else {
                        if (Number(Date.now()) - Number(checkContracts[i].blockTime) > process.env.check_time * 1000) {
                            check.push(i);
                        } else {
                            console.log('No liquidity found for the ERC20 token on Uniswap.');
                        }

                    }
                }
                console.log(check.length)
                if (check.length > 0) {
                    for (let item = check.length - 1; item >= 0; item--) {
                        checkContracts.splice(check[item], 1);
                        console.log("checkaddress")
                    }

                    fs.writeFileSync(contractPath, JSON.stringify(checkContracts, null, "\t"));
                }

            }
            checkLiquidity = false;
        }
    } catch (err) {
        console.log(err);
    }

}

const main = async () => {
    setInterval(getNewContracts, 15000);
    setInterval(getCheckLiquidity, 15000);
}
main()