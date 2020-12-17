import { expect } from './setup'
import { l2ethers as ethers} from 'hardhat'
//import { ethers } from 'hardhat'
import { ContractFactory, Contract, Signer } from 'ethers'
import { smockit, MockContract } from '@eth-optimism/smock'
import { getContractInterface } from '../src/contract-defs'


const makeHexString = (byte: string, len: number): string => {
  return '0x' + byte.repeat(len)
}
const RANDOM_ADDRESS = '0x1234123412341234123412341234123412341234'
const NON_NULL_BYTES32 = makeHexString('11', 32)

const getXDomainCalldata = (
  sender: string,
  target: string,
  message: string,
): string => {
  return getContractInterface(
    'MockCrossDomainMessenger', true
  ).encodeFunctionData('simulateRelayMessage', [target, sender, message])
}

describe.only('L2ERC20', () => {

    let account1: Signer
    let account2: Signer
    let account3: Signer
    let account4: Signer
    before(async () => {
      ;[account1, account2, account3, account4] = await ethers.getSigners()
    })

    const name = 'Some Really Cool Token Name'
    const initialSupply = 10_000_000

    let Mock__OVM_L2CrossDomainMessenger: MockContract
    //let Mock__MockCrossDomainMessenger: MockContract
    let Mock__L1ERC20Deposit: MockContract

    before( async () => {

        Mock__OVM_L2CrossDomainMessenger = await smockit(
          await ethers.getContractFactory('OVM_L2CrossDomainMessenger')
        )

        //Mock__MockCrossDomainMessenger = await smockit(
        //  await ethers.getContractFactory('MockCrossDomainMessenger')
        //)

        Mock__L1ERC20Deposit = await smockit(
          await ethers.getContractFactory('L1ERC20Deposit')
        )

    })

    let MockCrossDomainMessenger: Contract
    beforeEach(async () => {
      MockCrossDomainMessenger = await (await ethers.getContractFactory('MockCrossDomainMessenger'))
        .connect(account4)
        .deploy()
    })

    //const L1ERC20DepositAddress = 0x1111111111111111111111111111111111111111
    let L2ERC20: Contract
    beforeEach(async () => {
      console.log("connecting to account1", await account1.getAddress())
      L2ERC20 = await (await ethers.getContractFactory('L2ERC20'))
        .connect(account1)
        .deploy(name, 0, "YY")
        await L2ERC20.init(Mock__OVM_L2CrossDomainMessenger.address, Mock__L1ERC20Deposit.address)
        console.log("inited L2ERC20 with L1ERC20Deposit addr:", Mock__L1ERC20Deposit.address)
    })

    describe('mint', () => {

        it('should revert when the messenger is not the L1 ERC20 deposit address', async () => {

          const sender = account1
          const depositor = account2
          const amount = 2_500_000

          Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
              RANDOM_ADDRESS
          )
          console.log("mocked xDomainMessageSender to rtn", RANDOM_ADDRESS)
          console.log("account1/sender", await sender.getAddress())
          console.log("account2/depositor", await depositor.getAddress())

          await expect(
            L2ERC20.connect(sender).mint(await depositor.getAddress(), amount)
          ).to.be.revertedWith("L1 ERC20 Deposit Address was not correct")

        })

        it('should revert when the sender is not the L2CrossDomainMessenger', async () => {

          const wrongL2XDomainMessenger = account1
          const depositor = account2
          const amount = 2_500_000

          Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
              Mock__L1ERC20Deposit.address
          )

          let otherL2ERC20Factory = await(await ethers.getContractFactory('L2ERC20')).connect(account3)

          console.log("connected otherL2ERC20 to account3:", await account3.getAddress())

          let otherL2ERC20 = await otherL2ERC20Factory.deploy(name, 0, "YY")
          console.log("otherL2ERC20", otherL2ERC20.address)

          await otherL2ERC20.init(Mock__OVM_L2CrossDomainMessenger.address, Mock__L1ERC20Deposit.address)

          console.log("Wrong l2xdomain msger/acct1", await wrongL2XDomainMessenger.getAddress())

          await expect(
            otherL2ERC20.connect(wrongL2XDomainMessenger).mint(await depositor.getAddress(), amount)
          ).to.be.revertedWith("Only messages relayed by L2CrossDomainMessenger can mint")
        })

          //otherL2ERC20 = await (await ethers.getContractFactory('L2ERC20')).connect(account3).deploy(name, 0, "YY")


        it('should succeed when the depositor and sender are correct', async () => {


          const sender = account1
          const target = account2
          const amount = 2_500_000

          Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
            Mock__L1ERC20Deposit.address
          )
          console.log("calling getXDomainCalldata for message");

          let message = getXDomainCalldata(await target.getAddress(), await sender.getAddress(), NON_NULL_BYTES32)
          console.log("message", message)
          await MockCrossDomainMessenger.simulateRelayMessage(target, sender, message)
          console.log("simulate ")
          await L2ERC20.connect(sender).mint(await target.getAddress(), amount)

          expect(
            await L2ERC20.balanceOf(await target.getAddress()).to.equal(initialSupply + amount)
          )

        })

    })
})

