/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
import {Gateway, GatewayOptions, Network} from 'fabric-network';
import * as path from 'path';
import * as CircularJSON from 'circular-json';
import * as common from 'fabric-common';
import * as common2 from 'fabric-protos';
import { buildCCPOrg1, buildWallet, prettyJSONString } from '../utils/AppUtil';
import { buildCAClient, enrollAdmin, registerAndEnrollUser } from '../utils/CAUtil';

const channelName = 'mychannel';
const chaincodeName = 'basic';
const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, '..', 'wallet');
const org1UserId = 'appUser1';

/**
 * To see the SDK workings, try setting the logging to show on the console before running
 *        export HFC_LOGGING='{"debug":"console"}'
 */
async function main() {
    try {
        // ConnectionProfile 네트워크 설정, org1 사용
        const ccp = buildCCPOrg1();

        // 위에서 빌드한 네트워크 설정정보에 따른 fabric ca 서비스 클라이언트를 올림
        const caClient = buildCAClient(ccp, 'ca.org1.example.com');

        // 애플리케이션 유저의 크레덴셜을 포함한 월렛 올림
        const wallet = await buildWallet(walletPath);

        // admin 유저 최초 한 번 등록
        await enrollAdmin(caClient, wallet, mspOrg1);

        // org1 유저 최초 한 번 등록
        await registerAndEnrollUser(caClient, wallet, mspOrg1, org1UserId, 'org1.department1');

        // 게이트웨이
        const gateway = new Gateway();
        const gatewayOpts: GatewayOptions = {
            wallet,
            identity: org1UserId,   // org1 유저 아이덴티티로 게이트웨이를 설정한다.
            discovery: { enabled: true, asLocalhost: true }, // using asLocalhost as this gateway is using a fabric network deployed locally
        };

        try {
            // 게이트웨이 -> 네트워크 -> 컨트랙트 획득
            // 해당 게이트웨이를 통해 제출되는 모든 트랜잭션은 월렛에 저장된 크레덴셜을 사용하여 사인됨.
            await gateway.connect(ccp, gatewayOpts);
            const network = await gateway.getNetwork(channelName);
            const contract = network.getContract(chaincodeName);

            // Invoke: InitLedger, 최초 한 번만 실행
            // 인보크는 이벤트를 캐치할 수 있다!
            // console.log('\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger');
            // await contract.submitTransaction('InitLedger');
            // console.log('*** Result: committed');

            // Query: GetAllAssets
            // 하나의 피어에만 제출되며 결과값을 반환 받음.
            // 쿼리는 이벤트를 캐치할 수 없다!
            console.log('\n--> Evaluate Transaction: GetAllAssets, function returns all the current assets on the ledger');
            let result = await contract.evaluateTransaction('GetAllAssets');
            console.log(`*** Result: ${prettyJSONString(result.toString())}`);

            // Invoke: CreateAsset (asset13)
            // 트랜잭션이 모든 피어로 제출되며 모든 endors 통과한 다음에는 orderer로 제출되어 커밋됨.
            // console.log('\n--> Submit Transaction: CreateAsset, creates new asset with ID, color, owner, size, and appraisedValue arguments');
            // await contract.submitTransaction('CreateAsset', 'asset13', 'yellow', '5', 'Tom', '1300');
            // console.log('*** Result: committed');

            // Query: ReadAsset (asset13)
            console.log('\n--> Evaluate Transaction: ReadAsset, function returns an asset with a given assetID');
            result = await contract.evaluateTransaction('ReadAsset', 'asset13');
            console.log(`*** Result: ${prettyJSONString(result.toString())}`);

            // Query: AssetExists (asset1)
            console.log('\n--> Evaluate Transaction: AssetExists, function returns "true" if an asset with given assetID exist');
            result = await contract.evaluateTransaction('AssetExists', 'asset1');
            console.log(`*** Result: ${prettyJSONString(result.toString())}`);

            // Invoke: UpdateAsset (asset1)
            // fixme
            console.log('\n--> Submit Transaction: UpdateAsset asset1, change the appraisedValue to 350');
            const tx = contract.createTransaction('UpdateAsset');
            const txResult = await tx.submit('asset1', 'blue', '5', 'Tomoko', '350');
            console.log("🔴");
            console.log(`txId: ${tx.getTransactionId()}`);
            // console.log("tx: ");
            // console.log(CircularJSON.stringify(tx));
            console.log(`result: ${txResult.toString()}`);
            console.log('*** Result: committed');

            console.log("👀 CHECK QSCC !!!");
            await checkArgsByQscc(network, tx.getTransactionId());

            // Query: ReadAsset (asset1)
            console.log('\n--> Evaluate Transaction: ReadAsset, function returns "asset1" attributes');
            result = await contract.evaluateTransaction('ReadAsset', 'asset1');
            console.log(`*** Result: ${prettyJSONString(result.toString())}`);

            try {
                // 일부러 체인코드에서 에러를 던지는 상황 만들기 (존재하지 않는 asset70 을 업데이트 하려고 시도함)
                // submitTransaction 메서드가 에러를 던지고, 로그로 확인 가능
                console.log('\n--> Submit Transaction: UpdateAsset asset70, asset70 does not exist and should return an error');
                await contract.submitTransaction('UpdateAsset', 'asset70', 'blue', '5', 'Tomoko', '300');
                console.log('******** FAILED to return an error');
            } catch (error) {
                console.log(`*** Successfully caught the error: \n    ${error}`);
            }

            // Invoke: TransferAsset (asset1)
            console.log('\n--> Submit Transaction: TransferAsset asset1, transfer to new owner of Tom');
            await contract.submitTransaction('TransferAsset', 'asset1', 'Tom');
            console.log('*** Result: committed');

            // Query: ReadAsset (asset1)
            console.log('\n--> Evaluate Transaction: ReadAsset, function returns "asset1" attributes');
            result = await contract.evaluateTransaction('ReadAsset', 'asset1');
            console.log(`*** Result: ${prettyJSONString(result.toString())}`);
        } finally {
            gateway.disconnect();
        }
    } catch (error) {
        console.error(`******** FAILED to run the application: ${error}`);
    }
}

async function checkArgsByQscc(network: Network, transactionId: string) {
    const contract = network.getContract("qscc");
    const result = await contract.evaluateTransaction("GetTransactionByID", "mychannel", transactionId);

    const BlockDecoder = (common as any).BlockDecoder;
    const transactionEnvelope = BlockDecoder.decodeTransaction(result).transactionEnvelope;
    const chaincodeSpec =
        transactionEnvelope.payload.data.actions[0].payload
            .chaincode_proposal_payload.input.chaincode_spec;
    const args = chaincodeSpec.input.args;

    console.log("🟢");
    console.log(args.toString());
}

main();
