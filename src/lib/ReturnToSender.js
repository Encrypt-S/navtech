'use strict'

const lodash = require('lodash')

let Logger = require('./Logger.js') //eslint-disable-line
let privateSettings = require('../settings/private.settings.json') //eslint-disable-line
let SendRawTransaction = require('../lib/SendRawTransaction.js') //eslint-disable-line

const ReturnToSender = {
  runtime: {},
}

ReturnToSender.send = (options, callback) => {
  console.log('ReturnToSender.send')
  const required = ['client', 'transaction']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('RTS_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to ReturnAllToSenders.run' })
    return
  }

  ReturnToSender.runtime = {}

  options.client.getRawTransaction(options.transaction.txid).then((incomingRaw) => {
    console.log('getRawTransaction', incomingRaw)
    ReturnToSender.decodeOriginRaw({
      transaction: options.transaction,
      client: options.client,
      incomingRaw,
    }, callback)
    return
  }).catch((err) => {
    console.log('RTS_002', err)
    Logger.writeLog('RTS_002', 'unable to get raw transaction', {
      transaction: options.transaction,
      error: err,
    })
    callback(false, { message: 'unable to get raw transaction' })
  })
}

ReturnToSender.decodeOriginRaw = (options, callback) => {
  console.log('ReturnToSender.decodeOriginRaw')
  options.client.decodeRawTransaction(options.incomingRaw).then((incomingTrans) => {
    ReturnToSender.getOriginRaw({
      transaction: options.transaction,
      client: options.client,
      incomingTrans,
    }, callback)
    return
  }).catch((err) => {
    Logger.writeLog('RTS_003', 'unable to decode raw transaction', {
      transaction: options.transaction,
      incomingRaw: options.incomingRaw,
      error: err,
    })
    callback(false, { message: 'unable to decode raw transaction' })
  })
}

ReturnToSender.getOriginRaw = (options, callback) => {
  console.log('ReturnToSender.getOriginRaw')
  options.client.getRawTransaction(options.incomingTrans.vin[0].txid).then((inputRaw) => {
    ReturnToSender.decodeOriginInputRaw({
      transaction: options.transaction,
      client: options.client,
      incomingTrans: options.incomingTrans,
      inputRaw,
    }, callback)
    return
  }).catch((err) => {
    Logger.writeLog('RTS_004', 'unable to get the origins raw transaction', {
      transaction: options.transaction,
      incomingTrans: options.incomingTrans,
      error: err,
    })
    callback(false, { message: 'unable to get the origins raw transaction' })
  })
}

ReturnToSender.decodeOriginInputRaw = (options, callback) => {
  console.log('ReturnToSender.decodeOriginInputRaw')
  options.client.decodeRawTransaction(options.inputRaw).then((inputTrans) => {
    const origin = inputTrans.vout[options.incomingTrans.vin[0].vout].scriptPubKey.addresses[0]
    ReturnToSender.buildTransaction({
      transaction: options.transaction,
      client: options.client,
      origin,
    }, callback)
    return
  }).catch((err) => {
    Logger.writeLog('RTS_005', 'unable to decode raw incoming transaction', {
      transaction: options.transaction,
      inputRaw: options.inputRaw,
      error: err,
    })
    callback(false, { message: 'unable to decode raw incoming transaction' })
  })
}

ReturnToSender.buildTransaction = (options, callback) => {
  console.log('ReturnToSender.buildTransaction')
  const outgoingTransactions = {}
  const satoshiFactor = 100000000
  const newAmountFloat = options.transaction.amount - privateSettings.txFee
  const amountSatoshi = Math.round(newAmountFloat * satoshiFactor)

  outgoingTransactions[options.origin] = amountSatoshi / satoshiFactor

  const spentTransactions = [{
    txid: options.transaction.txid,
    vout: options.transaction.vout,
  }]
  SendRawTransaction.createRaw({
    outgoingTransactions,
    spentTransactions,
    client: options.client,
  }, callback)
}

module.exports = ReturnToSender
