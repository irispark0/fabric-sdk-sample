# 실행 환경
* fabric-samples v2.2 의 네트워크 사용
* 설정 파일, crypto, peer, orderer 정보는 fabric-samples v2.2 의 소스를 그대로 가져옴
  * `~/organizations`
* asset-transfer-basic 체인코드를 수정하여 사용함
  * `SetEvent` 추가
* 네트워크 빌드 및 체인코드 배포 스크립트
```shell
./network.sh up createChannel -ca
./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-go -ccl go
```

# 애플리케이션 실행 방법
`package.json` 참고
## event listener
```shell
npm run start:evt
```

## transaction sender
```shell
npm run start:tx
```