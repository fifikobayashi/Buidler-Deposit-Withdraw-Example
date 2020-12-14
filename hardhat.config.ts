import { HardhatUserConfig } from 'hardhat/config'

import '@nomiclabs/hardhat-ethers'
import '@eth-optimism/plugins/hardhat'

const config: HardhatUserConfig = {
  solidity: {
    version: '0.7.4',
  },
  paths: {
    sources: './contracts',
    tests: './test',
  },
}

export default config
