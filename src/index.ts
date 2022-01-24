import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import { ethers, providers, utils, Wallet } from "ethers";
import { getDefaultRelaySigningKey } from "./utils";

const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY || ""

const FLASHBOTS_RELAY_SIGNING_KEY = process.env.FLASHBOTS_RELAY_SIGNING_KEY || getDefaultRelaySigningKey();

if (PRIVATE_KEY === "") {
  console.warn("Must provide PRIVATE_KEY environment variable")
  process.exit(1)
}

if (FLASHBOTS_RELAY_SIGNING_KEY === "") {
  console.warn("Must provide FLASHBOTS_RELAY_SIGNING_KEY. Please see https://github.com/flashbots/pm/blob/main/guides/searcher-onboarding.md")
  process.exit(1)
}

const provider = new providers.StaticJsonRpcProvider(ETHEREUM_RPC_URL);

const arbitrageSigningWallet = new Wallet(PRIVATE_KEY);
const flashbotsRelaySigningWallet = new Wallet(FLASHBOTS_RELAY_SIGNING_KEY);

const wallet2 = new Wallet(process.env.PRIVATE_KEY2!);

async function main() {
  console.log("Searcher Wallet Address: " + await arbitrageSigningWallet.getAddress())
  console.log("wallet2 Address: " + await wallet2.getAddress())
  console.log("Flashbots Relay Signing Wallet Address: " + await flashbotsRelaySigningWallet.getAddress())

  const flashbotsProvider = await FlashbotsBundleProvider.create(provider, flashbotsRelaySigningWallet);

  const FTTransferAddress = "0x926b31D4BA670e2AAAF14962A34d157c7fFCC222"
  const IMX = "0xF57e7e7C23978C3cAEC3C3548E3D615c346e79fF"

  const ifce = new ethers.utils.Interface(['function approve(address spender, uint256 amount)'])
  const data = ifce.encodeFunctionData("approve", [FTTransferAddress, ethers.utils.parseEther("10000")])

  const signedTransactions = await flashbotsProvider.signBundle([
    {
      signer: arbitrageSigningWallet,
      transaction: {
        to: "",
        gasPrice: 200771641539, //30000000001 30gwei 
        gasLimit: 21000,
        chainId: 1,
        value: utils.parseEther("0.018"),
      },
    },
    {
      signer: wallet2,
      transaction: {
        to: IMX,
        gasPrice: 200771641539, //30000000001 30gwei 
        gasLimit: 86287,
        chainId: 1,
        // value: 0,
        data: data
      },
    },
  ]);

  const blockNumber = await provider.getBlockNumber();

  const simulation = await flashbotsProvider.simulate(
    signedTransactions,
    blockNumber + 1
  );

  // Using TypeScript discrimination
  if ("error" in simulation) {
    console.log(`Simulation Error: ${simulation.error.message}`);
    return
  } else {
    console.log(
      `Simulation Success: ${blockNumber} ${JSON.stringify(
        simulation,
        null,
        2
      )}`
    );
  }

  // return

  for (let i = 1; i <= 20; i++) {
    const bundleSubmission = flashbotsProvider.sendRawBundle(
      signedTransactions,
      blockNumber + i
    );
    console.log("submitted for block # ", blockNumber + i);
  }
  console.log("bundles submitted");

}

main();
