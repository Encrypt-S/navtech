const lodash = require('lodash')

const privateSettings = require('../settings/private.settings.json')
const Logger = require('./Logger.js')
const NavCoin = require('./NavCoin.js')

const PreFlight = {}

PreFlight.run = (options, callback) => {
  const required = ['navClient', 'subClient', 'settings']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('PRE_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to Preflight.checkNavBlocks' })
    return
  }

  PreFlight.runtime = {
    callback,
    navClient: options.navClient,
    subClient: options.subClient,
    settings: options.settings,
  }

  NavCoin.checkBlockHeight({
    client: PreFlight.runtime.navClient,
    blockThreshold: privateSettings.blockThreshold.processing,
  }, PreFlight.navBlocksChecked)
}

PreFlight.navBlocksChecked = (status, data) => {
  if (!status || !data) {
    Logger.writeLog('PRE_002', 'navClient block check failed', { status, data })
    PreFlight.runtime.callback(false, { message: 'navClient block check failed' })
    return
  }
  PreFlight.runtime.navBalance = data.balance
  PreFlight.runtime.navClient.setTxFee(parseFloat(privateSettings.txFee)).then(() => {
    NavCoin.checkBlockHeight({
      client: PreFlight.runtime.subClient,
      blockThreshold: privateSettings.blockThreshold.processing,
    }, PreFlight.subBlocksChecked)
  })
  .catch((err) => {
    Logger.writeLog('PRE_003', 'failed to set NAV tx fee', { err })
    PreFlight.runtime.callback(false, { message: 'failed to set NAV tx fee' })
    return
  })
}

PreFlight.subBlocksChecked = (status, data) => {
  if (!status || !data) {
    Logger.writeLog('PRE_004', 'subClient block check failed', { status, data })
    PreFlight.runtime.callback(false, { message: 'subClient block check failed' })
    return
  }
  PreFlight.runtime.subBalance = data.balance
  NavCoin.unlockWallet({
    settings: PreFlight.runtime.settings,
    client: PreFlight.runtime.navClient,
    type: 'navCoin',
  }, PreFlight.navClientUnlocked)
}

PreFlight.navClientUnlocked = (status, data) => {
  if (!status) {
    Logger.writeLog('PRE_005', 'navClient failed to unlock', { status, data })
    PreFlight.runtime.callback(false, { message: 'navClient failed to unlock' })
    return
  }
  NavCoin.unlockWallet({
    settings: PreFlight.runtime.settings,
    client: PreFlight.runtime.subClient,
    type: 'subChain',
  }, PreFlight.subClientUnlocked)
}

PreFlight.subClientUnlocked = (status, data) => {
  if (!status) {
    Logger.writeLog('PRE_006', 'subClient failed to unlock', { status, data })
    PreFlight.runtime.callback(false, { message: 'subClient failed to unlock' })
    return
  }
  PreFlight.runtime.subClient.setTxFee(parseFloat(privateSettings.subChainTxFee)).then(() => {
    PreFlight.runtime.callback(true, {
      navBalance: PreFlight.runtime.navBalance,
      subBalance: PreFlight.runtime.subBalance,
    })
  })
  .catch((err) => {
    Logger.writeLog('PRE_003', 'failed to set SUB tx fee', { err })
    PreFlight.runtime.callback(false, { message: 'failed to set SUB tx fee' })
    return
  })
}

module.exports = PreFlight
