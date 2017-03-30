const lodash = require('lodash')
let request = require('request') //eslint-disable-line

let Logger = require('./Logger.js') //eslint-disable-line
let NavCoin = require('./NavCoin.js') //eslint-disable-line

const RetrieveSubchainAddresses = {}

RetrieveSubchainAddresses.run = (options, callback) => {
  const required = ['subClient', 'chosenOutgoing', 'currentBatch']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('RSC_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to RetrieveSubchainAddresses.run' })
    return
  }
  RetrieveSubchainAddresses.runtime = {
    callback,
    subClient: options.subClient,
    chosenOutgoing: options.chosenOutgoing,
    currentBatch: options.currentBatch,
  }

  RetrieveSubchainAddresses.getSubAddresses()
}

RetrieveSubchainAddresses.getSubAddresses = () => {
  const chosenOutgoing = RetrieveSubchainAddresses.runtime.chosenOutgoing

  const outgoingAddress = chosenOutgoing.port ? chosenOutgoing.ipAddress + ':' + chosenOutgoing.port : chosenOutgoing.ipAddress
  RetrieveSubchainAddresses.runtime.outgoingAddress = outgoingAddress
  const options = {
    uri: 'https://' + outgoingAddress + '/api/get-addresses',
    method: 'POST',
    timeout: 60000,
    rejectUnauthorized: false,
    requestCert: true,
    agent: false,
    form: {
      type: 'SUBCHAIN',
      account: 'OUTGOING',
      num_addresses: RetrieveSubchainAddresses.runtime.currentBatch.length,
    },
  }

  request(options, RetrieveSubchainAddresses.requestResponse)
}

RetrieveSubchainAddresses.requestResponse = (err, response, body) => {
  if (err) {
    Logger.writeLog('RSC_004', 'failed to query outgoing server', {
      error: err,
      outgoingAddress: RetrieveSubchainAddresses.runtime.outgoingAddress,
    })
    RetrieveSubchainAddresses.runtime.callback(false, { message: 'failed to query outgoing server' })
    return
  }
  RetrieveSubchainAddresses.checkOutgoingCanTransact(body, RetrieveSubchainAddresses.runtime.outgoingAddress)
}

RetrieveSubchainAddresses.checkOutgoingCanTransact = (body, outgoingAddress) => {
  try {
    const bodyJson = JSON.parse(body)
    if (bodyJson.type !== 'SUCCESS') {
      Logger.writeLog('RSC_005', 'outgoing server returned failure', { body: bodyJson, outgoingAddress })
      RetrieveSubchainAddresses.runtime.callback(false, { message: 'outgoing server returned failure' })
      return
    }
    if (!bodyJson.data || !bodyJson.data.addresses || bodyJson.data.addresses.constructor !== Array) {
      Logger.writeLog('RSC_006', 'outgoing server returned incorrect params', { body: bodyJson, outgoingAddress })
      RetrieveSubchainAddresses.runtime.callback(false, { message: 'outgoing server returned failure' })
      return
    }
    RetrieveSubchainAddresses.checkSubAddresses(bodyJson.data.addresses)
  } catch (error) {
    Logger.writeLog('RSC_005A', 'outgoing server returned non json response', { body, error, outgoingAddress })
    RetrieveSubchainAddresses.runtime.callback(false, { message: 'outgoing server returned non json response' })
    return
  }
}

RetrieveSubchainAddresses.checkSubAddresses = (outgoingSubAddresses) => {
  if (outgoingSubAddresses.length < 1) {
    Logger.writeLog('RSC_007', 'outgoing server must provide at least one sub address', {
      subAddresses: outgoingSubAddresses,
    })
    RetrieveSubchainAddresses.runtime.callback(false, { message: 'outgoing server must provide at least one sub address' })
    return
  }
  if (outgoingSubAddresses.length < RetrieveSubchainAddresses.runtime.currentBatch.length) {
    Logger.writeLog('RSC_008', 'outgoing server did not provide enough sub addresses', {
      subAddressesLength: outgoingSubAddresses.length,
      currentBatchLength: RetrieveSubchainAddresses.runtime.currentBatch.length,
    })
    RetrieveSubchainAddresses.runtime.callback(false, { message: 'outgoing server did not provide enough sub addresses' })
    return
  }
  RetrieveSubchainAddresses.runtime.outgoingSubAddresses = outgoingSubAddresses
  NavCoin.validateAddresses({
    client: RetrieveSubchainAddresses.runtime.subClient,
    addresses: outgoingSubAddresses,
  }, RetrieveSubchainAddresses.subAddressesValid)
}

RetrieveSubchainAddresses.subAddressesValid = (success) => {
  if (!success) {
    Logger.writeLog('RSC_009', 'invalid subchain addresses received', {
      subAddresses: RetrieveSubchainAddresses.runtime.outgoingSubAddresses,
    })
    RetrieveSubchainAddresses.runtime.callback(false, { message: 'invalid subchain addresses received' })
    return
  }
  RetrieveSubchainAddresses.runtime.callback(true, {
    subAddresses: RetrieveSubchainAddresses.runtime.outgoingSubAddresses,
  })
}

module.exports = RetrieveSubchainAddresses
