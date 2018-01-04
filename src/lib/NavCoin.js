'use strict'

const config = require('config')
const lodash = require('lodash')

const Logger = require('./Logger.js')

let globalSettings = config.get('GLOBAL') // eslint-disable-line

const NavCoin = {}

NavCoin.unlockWallet = (options, callback) => {
  const required = ['settings', 'client', 'type']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('NAV_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to NavCoin.unlockWallet' })
    return
  }

  if (globalSettings.encryptedWallet === false) {
    callback(true)
    return
  }
  const unlockTime = options.settings.scriptInterval / 1000
  options.client.walletPassphrase(options.settings[options.type].walletPassphrase, unlockTime).then(() => {
    callback(true)
    return
  }).catch((err) => {
    switch (err.code) {
      case -17: // wallet already unlocked
        callback(true)
        break
      default:
        callback(false, { message: 'failed to unlock' })
        Logger.writeLog('NAV_002', 'failed to unlock ' + options.type + ' wallet', { error: err })
        return
    }
  })
}

NavCoin.lockWallet = (options, callback) => {
  const required = ['type', 'client']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('NAV_003', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to NavCoin.lockWallet' })
    return
  }
  options.client.walletLock().then(() => {
    Logger.writeLog('NAV_004', 'locked the ' + options.type + ' wallet', options)
    NavCoin.unlockWallet(options, callback)
  }).catch((err) => {
    callback(false, { message: 'failed to lock' })
    Logger.writeLog('NAV_005', 'failed to lock ' + options.type + ' wallet', { error: err })
    return
  })
}

NavCoin.filterUnspent = (options, callback) => {
  const required = ['unspent', 'client', 'accountName']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('NAV_006', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to NavCoin.filterUnspent' })
    return
  }
  try {
    options.client.getAddressesByAccount(options.accountName).then((addresses) => {
      console.log('addresses:', addresses)
      let hasPending = false
      const currentPending = []
      for (const pending of options.unspent) {
        if (addresses.indexOf(pending.address) !== -1) {
          hasPending = true
          currentPending.push(pending)
        }
      }
      if (hasPending) {
        callback(true, { currentPending })
        return
      }
      callback(true)
      return
    }).catch((err) => {
      Logger.writeLog('NAV_007', 'failed to get address by account', { error: err, options })
      callback(false)
      return
    })
  } catch (err) {
    Logger.writeLog('NAV_008', 'failed to filter', { error: err, options })
  }
}

NavCoin.checkBlockHeight = (options, callback) => {
  const required = ['client', 'blockThreshold']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('NAV_009', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to NavCoin.checkBlockHeight' })
    return
  }
  options.client.getInfo().then((walletInfo) => {
    options.client.getBlockCount().then((blockCount) => {
      if (parseInt(blockCount, 10) - options.blockThreshold > parseInt(walletInfo.blocks, 10)) {
        Logger.writeLog('NAV_010', 'client is not synced with the latest blocks', { walletInfo, blockCount })
        callback(false, { message: 'client is not synced with the latest blocks' })
        return
      }
      callback(true, { balance: walletInfo.balance })
      return
    }).catch((err) => {
      Logger.writeLog('NAV_011', 'failed to get block count', { error: err, options })
      callback(false, { message: 'failed to get block count' })
      return
    })
  }).catch((err) => {
    Logger.writeLog('NAV_012', 'failed to get info', { error: err, options })
    callback(false, { message: 'failed to get info' })
    return
  })
}

NavCoin.validateAddresses = (options, callback) => {
  const required = ['client', 'addresses']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('NAV_013', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to NavCoin.validateAddresses' })
    return
  }
  if (options.addresses.length === 0) {
    callback(true)
    return
  }
  options.client.validateAddress(options.addresses[0]).then((addressInfo) => {
    if (addressInfo.isvalid !== true) {
      Logger.writeLog('NAV_014', 'provided address is invalid', { address: options.addresses[0] })
      callback(false, { message: 'provided address is invalid' })
      return
    }
    NavCoin.validateAddresses({
      addresses: options.addresses.slice(1),
      client: options.client,
    }, callback)
    return
  }).catch((err) => {
    Logger.writeLog('NAV_015', 'failed to validate address', { error: err, options })
    callback(false, { message: 'failed to validate address' })
    return
  })
}

module.exports = NavCoin
