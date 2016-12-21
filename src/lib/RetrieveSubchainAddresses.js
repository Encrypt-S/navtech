const lodash = require('lodash')
const request = require('request')

const Logger = require('./Logger.js')
const NavCoin = require('./NavCoin.js')

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

  const outgoingHost = chosenOutgoing.host ? chosenOutgoing.host : chosenOutgoing.ipAddress
  const outgoingAddress = chosenOutgoing.port ? outgoingHost + ':' + chosenOutgoing.port : outgoingHost
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

  request(options, (err, response, body) => {
    if (err) {
      Logger.writeLog('RSC_004', 'failed to query outgoing server', { error: err, outgoingAddress })
      RetrieveSubchainAddresses.runtime.callback(false, { message: 'failed to query outgoing server' })
      return
    }
    RetrieveSubchainAddresses.checkOutgoingCanTransact(body, outgoingAddress)
  })
}

RetrieveSubchainAddresses.checkOutgoingCanTransact = (body, outgoingAddress) => {
  const bodyJson = JSON.parse(body)
  if (bodyJson.type !== 'SUCCESS') {
    Logger.writeLog('RSC_005', 'outgoing server returned failure', { body: bodyJson, outgoingAddress })
    RetrieveSubchainAddresses.runtime.callback(false, { message: 'outgoing server returned failure' })
    return
  }
  if (!bodyJson.data || !bodyJson.data.addresses) {
    Logger.writeLog('RSC_006', 'outgoing server returned incorrect params', { body: bodyJson, outgoingAddress })
    RetrieveSubchainAddresses.runtime.callback(false, { message: 'outgoing server returned failure' })
    return
  }
  RetrieveSubchainAddresses.checkSubAddresses(bodyJson.data.addresses)
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
