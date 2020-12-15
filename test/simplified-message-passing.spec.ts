import { expect } from './setup'

/* External Imports */
import { ethers } from 'hardhat'
import { Signer, ContractFactory, Contract } from 'ethers'
import { initCrossDomainMessengers, relayL1ToL2Messages, relayL2ToL1Messages } from '@eth-optimism/ovm-toolchain'
import { assert } from 'console'

/* Internal Imports */
//import { increaseEthTime } from '../helpers'

//TODO: add in delays
const l1ToL2MessageDelay = 0 //5 * 60 //5 minutes
const l2ToL1MessageDelay = 0 //60 * 60 * 24 * 7 //1 week

describe('EOA L1 <-> L2 Message Passing', () => {
  let AliceL1Wallet: Signer
  let BobL1Wallet: Signer
  let MalloryL1Wallet: Signer
  before(async () => {
    ;[AliceL1Wallet, BobL1Wallet, MalloryL1Wallet] = await ethers.getSigners()
  })

  let signer: Signer
  before(async () => {
    ;[signer] = await ethers.getSigners()
  })

  let L1_CrossDomainMessenger: Contract
  let L2_CrossDomainMessenger: Contract
  beforeEach(async () => {
    const messengers = await initCrossDomainMessengers(
      l1ToL2MessageDelay,
      l2ToL1MessageDelay,
      ethers,
      signer
    )

    L1_CrossDomainMessenger = messengers.l1CrossDomainMessenger
    L2_CrossDomainMessenger = messengers.l2CrossDomainMessenger
  })

  let ERC20Factory: ContractFactory
  let L2ERC20Factory: ContractFactory
  let L1ERC20DepositFactory: ContractFactory
  before(async () => {
    ERC20Factory = await ethers.getContractFactory('ERC20')
    L2ERC20Factory = await ethers.getContractFactory('L2ERC20')
    L1ERC20DepositFactory = await ethers.getContractFactory('L1ERC20Deposit')
  })

  let L1ERC20: Contract
  let L2ERC20: Contract
  let L1ERC20Deposit: Contract
  beforeEach(async () => {
    L1ERC20 = await ERC20Factory.deploy(
      10000,
      'TEST TOKEN',
      0,
      'TEST',
    )
    L2ERC20 = await L2ERC20Factory.deploy(
      'TEST TOKEN',
      0,
      'TEST',
    )
    L1ERC20Deposit = await L1ERC20DepositFactory.deploy(
      L1ERC20.address,
      L2ERC20.address,
      L1_CrossDomainMessenger.address
    )
    L2ERC20.init(L2_CrossDomainMessenger.address, L1ERC20Deposit.address);
  })

  describe('deposit and withdrawal', () => {

    it('should allow an EOA to deposit and withdraw between one wallet', async () => {

      await L1ERC20.approve(L1ERC20Deposit.address, 5000)
      await L1ERC20Deposit.deposit(AliceL1Wallet.getAddress(), 5000)
      await relayL1ToL2Messages(signer)

      let l2balance = await L2ERC20.balanceOf(await AliceL1Wallet.getAddress())
      let l1balance = await L1ERC20.balanceOf(await AliceL1Wallet.getAddress())
      expect(l2balance).to.be.equal(5000)
      expect(l1balance).to.be.equal(5000)

      await L2ERC20.connect(AliceL1Wallet).withdraw(2000)
      //await increaseEthTime(l1ToL2MessageDelay + 1)
      await relayL2ToL1Messages(signer)

      l2balance = await L2ERC20.balanceOf(await AliceL1Wallet.getAddress())
      l1balance = await L1ERC20.balanceOf(await AliceL1Wallet.getAddress())
      expect(l2balance).to.be.equal(3000)
      expect(l1balance).to.be.equal(7000)
    })

    it('should allow an EOA to deposit and withdraw between two wallets', async () => {
      await L1ERC20.approve(L1ERC20Deposit.address, 5000)
      await L1ERC20Deposit.deposit(AliceL1Wallet.getAddress(), 5000)
      await relayL1ToL2Messages(signer)
      L2ERC20.transfer(BobL1Wallet.getAddress(), 2000)

      expect( await L2ERC20.balanceOf(await AliceL1Wallet.getAddress()) ).to.be.equal(3000)
      expect( await L1ERC20.balanceOf(await AliceL1Wallet.getAddress()) ).to.be.equal(5000)
      expect( await L2ERC20.balanceOf(await BobL1Wallet.getAddress())   ).to.be.equal(2000)
      expect( await L1ERC20.balanceOf(await BobL1Wallet.getAddress())   ).to.be.equal(0)

      await L2ERC20.connect(BobL1Wallet).withdraw(1000)
      await relayL2ToL1Messages(signer)

      expect( await L2ERC20.balanceOf(await AliceL1Wallet.getAddress()) ).to.be.eq(3000)
      expect( await L1ERC20.balanceOf(await AliceL1Wallet.getAddress()) ).to.be.eq(5000)
      expect( await L2ERC20.balanceOf(await BobL1Wallet.getAddress())   ).to.be.eq(1000)
      expect( await L1ERC20.balanceOf(await BobL1Wallet.getAddress())   ).to.be.eq(1000)
    })

    it('should not allow Alice to withdraw transferred $', async () => {
      await L1ERC20.approve(L1ERC20Deposit.address, 5000)
      await L1ERC20Deposit.deposit(AliceL1Wallet.getAddress(), 5000)
      await relayL1ToL2Messages(signer)

      L2ERC20.transfer(BobL1Wallet.getAddress(), 5000)

      await expect( L2ERC20.connect(AliceL1Wallet).withdraw(2000) ).to.be.revertedWith("Account doesn't have enough coins to burn")
    })

    it('should not allow Bob to withdraw twice', async () => {
      await L1ERC20.approve(L1ERC20Deposit.address, 5000)
      await L1ERC20Deposit.deposit(AliceL1Wallet.getAddress(), 5000)
      await relayL1ToL2Messages(signer)

      L2ERC20.transfer(BobL1Wallet.getAddress(), 3000)

      await L2ERC20.connect(BobL1Wallet).withdraw(3000)
      await relayL2ToL1Messages(signer)

      await expect( L2ERC20.connect(BobL1Wallet).withdraw(3000) ).to.be.revertedWith("Account doesn't have enough coins to burn")
    })

    it('should not allow mallory to call withdraw', async () => {
      await L1ERC20.approve(L1ERC20Deposit.address, 5000)
      await L1ERC20Deposit.deposit(AliceL1Wallet.getAddress(), 5000)
      await relayL1ToL2Messages(signer)

      await expect( L2ERC20.connect(MalloryL1Wallet).withdraw(3000) ).to.be.revertedWith("Account doesn't have enough coins to burn")
    })

    it ('should not allow mallory to mint infinite money', async () => {
      await L1ERC20.approve(L1ERC20Deposit.address, 5000)
      await L1ERC20Deposit.deposit(AliceL1Wallet.getAddress(), 5000)
      await relayL1ToL2Messages(signer)

      await expect( L2ERC20.mint(MalloryL1Wallet.getAddress(), 7000) ).to.be.revertedWith("Only messages relayed by L2CrossDomainMessenger can mint")
    })

    it ('should not allow mallow to withdraw money that is not hers', async() => {
      await L1ERC20.approve(L1ERC20Deposit.address, 5000)
      await L1ERC20Deposit.deposit(AliceL1Wallet.getAddress(), 5000)
      await relayL1ToL2Messages(signer)

      await L2ERC20.withdraw(1000)
      await relayL2ToL1Messages(signer)

      await expect( L1ERC20Deposit.withdraw(MalloryL1Wallet.getAddress(), 2000) ).to.be.revertedWith("Only messages relayed by the L1CrossDomainMessenger can withdraw")
    })
  })
})