'use strict'

const config = require('config')
const lodash = require('lodash')

let Logger = require('./Logger.js') //eslint-disable-line
let NavCoin = require('./NavCoin.js') //eslint-disable-line

const globalSettings = config.get('GLOBAL')

let settings = false
if (globalSettings.serverType === 'INCOMING') settings = config.get('INCOMING')
if (globalSettings.serverType === 'OUTGOING') settings = config.get('OUTGOING')

const SendToAddress = {}

SendToAddress.send = (options, callback) => {
  const required = ['client', 'address', 'amount', 'transaction']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('STA_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to SelectOutgoing.run' })
    return
  }

  SendToAddress.runtime = {}

  if (options.counter && options.counter > 7) {
    Logger.writeLog('STA_002', 'max send attempts reached', { transaction: options.transaction, counter: options.counter })
    callback(false, { transaction: options.transaction, error: 'max send attempts reached' })
    return
  }

  options.client.sendToAddress(options.address, parseFloat(options.amount), null, null, options.encrypted).then((sendOutcome) => {
    if (sendOutcome) {
      callback(true, { sendOutcome, transaction: options.transaction })
      return
    }
  }).catch((err) => {
    if (err.code === -13 && !options.triedToUnlock) {
      SendToAddress.runtime.options = options
      SendToAddress.runtime.callback = callback
      const type = (options.client.port === settings.navCoin.port) ? 'navCoin' : 'subChain'
      NavCoin.unlockWallet({ settings, client: options.client, type }, SendToAddress.walletUnlocked)
      return
    }
    // @NOTE not able to test because timeout is longer than the tests will allow
    Logger.writeLog('STA_003', 'failed send to address', { transaction: options.transaction, error: err })
    setTimeout(() => {
      const counter = (options.counter) ? options.counter + 1 : 1
      const newOptions = {
        client: options.client,
        address: options.address,
        amount: options.amount,
        transaction: options.transaction,
        encrypted: options.encrypted,
        counter,
        triedToUnlock: false,
      }
      SendToAddress.send(newOptions, callback)
    }, 30000)
    return
  })
}

SendToAddress.walletUnlocked = (success, data) => {
  if (!success) {
    Logger.writeLog('STA_004', 'unable to unlock wallet', { success, data })
    SendToAddress.runtime.callback(false, {
      transaction: SendToAddress.runtime.options.transaction,
      error: data,
    })
    return
  }
  const options = {
    client: SendToAddress.runtime.options.client,
    address: SendToAddress.runtime.options.address,
    amount: SendToAddress.runtime.options.amount,
    transaction: SendToAddress.runtime.options.transaction,
    encrypted: SendToAddress.runtime.options.encrypted,
    counter: SendToAddress.runtime.options.counter,
    triedToUnlock: true,
  }
  SendToAddress.send(options, SendToAddress.runtime.callback)
}

module.exports = SendToAddress
