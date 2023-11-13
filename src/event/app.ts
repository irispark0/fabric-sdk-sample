import {ContractListener, Gateway, GatewayOptions} from "fabric-network";
import {buildCCPOrg1, buildWallet} from "../utils/AppUtil";
import * as path from 'path';

const channelName = "mychannel";
const contractName = "basic";
const walletPath = path.join(__dirname, '..', 'wallet');
const org1UserId = 'appUser1';

async function main() {
    try {
        const ccp = buildCCPOrg1();
        const wallet = await buildWallet(walletPath);
        const gatewayOpts: GatewayOptions = {
            wallet,
            identity: org1UserId,
            discovery: { enabled: true, asLocalhost: true },
        };

        const gateway = new Gateway();
        await gateway.connect(ccp, gatewayOpts);
        const network = await gateway.getNetwork(channelName);
        const contract = network.getContract(contractName);

        const listener: ContractListener = async (event) => {
            console.log("EVENT OCCURRED !");
            console.log("CHAINCODE ID:", event.chaincodeId);
            console.log("EVENT NAME:", event.eventName);
            console.log("EVENT PAYLOAD:");
            console.log(event.payload.toString("utf-8"));
        };
        await contract.addContractListener(listener);

        console.log("EVENT LISTENER START!");
    } catch (error) {
        console.error(`******** FAILED to run listener: ${error}`);
    }
}

main();