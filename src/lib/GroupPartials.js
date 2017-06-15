const lodash = require('lodash')

let Logger = require('./Logger.js') // eslint-disable-line
let EncryptedData = require('./EncryptedData.js') // eslint-disable-line

const GroupPartials = {}

GroupPartials.run = (options, callback) => {
  const required = ['currentPending', 'client']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('GRP_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to GroupPartials.run' })
    return
  }

  GroupPartials.runtime = {
    client: options.client,
    currentPending: options.currentPending,
    remainingToDecrypt: options.currentPending,
    transactionsToReturn: [],
    readyToProcess: {},
    partials: {},
    callback,
  }
  GroupPartials.getDecryptedData()
}

GroupPartials.getDecryptedData = () => {
  if (GroupPartials.runtime.remainingToDecrypt.length < 1) {
    GroupPartials.checkPartials()
    return
  }

  EncryptedData.getEncrypted({
    transaction: GroupPartials.runtime.remainingToDecrypt[0],
    client: GroupPartials.runtime.client,
  }, GroupPartials.checkDecrypted)
}

GroupPartials.partialFailed = (transaction) => {
  const returnIndex = lodash.findIndex(GroupPartials.runtime.transactionsToReturn, (tx) => tx.txid === transaction.txid)
  if (returnIndex === -1) {
    GroupPartials.runtime.transactionsToReturn.push(transaction)
  }
  GroupPartials.runtime.remainingToDecrypt.splice(0, 1)
  GroupPartials.getDecryptedData()
}

GroupPartials.checkDecrypted = (success, data) => {
  if (!success || !data || !data.decrypted || !data.transaction) {
    Logger.writeLog('GRP_002', 'failed to decrypt transaction data', { success })
    GroupPartials.partialFailed(GroupPartials.runtime.remainingToDecrypt[0])
    return
  }
  if (!data.decrypted.n || !data.decrypted.t || !data.decrypted.p || !data.decrypted.o || !data.decrypted.u) {
    Logger.writeLog('GRP_003', 'failed to receive correct encrypted params', {
      n: data.decrypted.n, // @TODO remove logging n before deployment
      t: data.decrypted.t,
      p: data.decrypted.p,
      o: data.decrypted.o,
      u: data.decrypted.u,
      data,
    })
    GroupPartials.partialFailed(data.transaction)
    return
  }

  console.log('GroupPartials.checkDecrypted', data)

  GroupPartials.runtime.client.validateAddress(data.decrypted.n).then((addressInfo) => {
    if (addressInfo.isvalid !== true) {
      Logger.writeLog('GRP_003A', 'encrypted address invalid', { success, data })
      GroupPartials.partialFailed(data.transaction)
      return
    }
    GroupPartials.groupPartials(data.decrypted, data.transaction)
  }).catch((err) => {
    Logger.writeLog('GRP_003B', 'failed to decrypt transaction data', { success, error: err })
    GroupPartials.partialFailed(data.transaction)
    return
  })
}

GroupPartials.groupPartials = (decrypted, transaction) => {
  if (!GroupPartials.runtime.partials[decrypted.u]) {
    GroupPartials.runtime.partials[decrypted.u] = {
      destination: decrypted.n,
      unique: decrypted.u,
      timeDelay: parseInt(decrypted.t, 10),
      parts: parseInt(decrypted.o, 10),
      partsSum: 0,
      amount: 0,
      transactions: {},
      readyToProcess: false,
    }
  }

  if (GroupPartials.runtime.partials[decrypted.u].readyToProcess === true) {
    Logger.writeLog('GRP_006', 'this partial group is already flagged as completed', {
      partials: GroupPartials.runtime.partials[decrypted.u],
      transaction,
      n: decrypted.n, // @TODO remove logging n before deployment
      t: decrypted.t,
      p: decrypted.p,
      o: decrypted.o,
      u: decrypted.u,
    })
    GroupPartials.partialFailed(transaction)
    return
  }

  if (GroupPartials.runtime.partials[decrypted.u].destination !== decrypted.n) {
    Logger.writeLog('GRP_004', 'decrypted address different from other partials', {
      partials: GroupPartials.runtime.partials[decrypted.u],
      transaction,
    })
    GroupPartials.partialFailed(transaction)
    return
  }

  if (GroupPartials.runtime.partials[decrypted.u].transactions[transaction.txid]) {
    Logger.writeLog('GRP_005', 'txid already processed', {
      partials: GroupPartials.runtime.partials[decrypted.u],
      transaction,
    })
    GroupPartials.partialFailed(transaction)
    return
  }

  const unsafeTotal = GroupPartials.runtime.partials[decrypted.u].amount += transaction.amount
  const safeTotal = Math.round(unsafeTotal * 100000000) / 100000000

  GroupPartials.runtime.partials[decrypted.u].amount = safeTotal
  GroupPartials.runtime.partials[decrypted.u].partsSum += parseInt(decrypted.p, 10)
  GroupPartials.runtime.partials[decrypted.u].transactions[transaction.txid] = {
    txid: transaction.txid,
    amount: transaction.amount,
    part: decrypted.p,
  }

  const numParts = GroupPartials.runtime.partials[decrypted.u].parts
  const numTransactions = lodash.size(GroupPartials.runtime.partials[decrypted.u].transactions)

  if (numTransactions === numParts
  && (numParts * (numParts + 1)) / 2 === GroupPartials.runtime.partials[decrypted.u].partsSum) {
    GroupPartials.runtime.partials[decrypted.u].readyToProcess = true
    GroupPartials.runtime.readyToProcess[decrypted.u] = GroupPartials.runtime.partials[decrypted.u]
  }
  GroupPartials.runtime.remainingToDecrypt.splice(0, 1)
  GroupPartials.getDecryptedData()
}

GroupPartials.checkPartials = () => {
  lodash.forEach(GroupPartials.runtime.partials, (partial) => {
    console.log('forEach runtime.partials as partial', partial)
    if (!partial.readyToProcess) {
      lodash.forEach(partial.transactions, (partialTx) => {
        console.log('forEach partial.transactions as partialTx', partialTx)
        const returnIndex = lodash.findIndex(GroupPartials.runtime.transactionsToReturn, (tx) => tx.txid === partialTx.txid)
        if (returnIndex === -1 && partialTx.confirmations > 120) { // if its not already flagged as returning & too old
          GroupPartials.runtime.transactionsToReturn.push(partialTx)
        }
      })
    }
  })

  console.log('GroupPartials.runtime.partials', GroupPartials.runtime.partials)

  GroupPartials.runtime.callback(true, {
    readyToProcess: GroupPartials.runtime.readyToProcess,
    transactionsToReturn: GroupPartials.runtime.transactionsToReturn,
  })
}

module.exports = GroupPartials
