'use strict'

const AddressGenerator = {}

AddressGenerator.generate = (options, callback) => {
  if (!options.accountName || !options.client || !options.maxAddresses) {
    console.log('STATUS: AddressGenerator.generate invalid params')
    callback(false)
    return
  }
  options.client.getAccountAddress(options.accountName).then(() => {
    console.log('STATUS: "' + options.accountName + '" account created')
    AddressGenerator.getAccountAddressesForGeneration(options, callback)
  })
  .catch((err) => {
    if (err.code === -12) {
      AddressGenerator.runKeypoolRefill()
    } else {
      console.log('ERROR: client.getAccountAddress failed', err)
      callback(false)
      return
    }
  })
}

AddressGenerator.runKeypoolRefill = (options, callback) => {
  options.client.keypoolRefill().then(() => {
    console.log('STATUS: keypool filled')
    AddressGenerator.generate(options, callback)
  }).catch((err2) => {
    console.log('ERROR: client.keypoolRefill failed', err2)
    callback(false)
    return
  })
}

AddressGenerator.getAccountAddressesForGeneration = (options, callback) => {
  options.client.getAddressesByAccount(options.accountName).then((addresses) => {
    console.log('STATUS: "' + options.accountName + '" account currently has ' + addresses.length + ' addresses')
    if (addresses.length < options.maxAddresses) {
      const numToGenerate = options.maxAddresses - addresses.length
      console.log('STATUS: generating ' + numToGenerate + ' more "' + options.accountName + '" addresses')
      AddressGenerator.generateNewAccountAddresses({
        client: options.client,
        accountName: options.accountName,
        maxAddresses: options.maxAddresses,
        numToGenerate,
      }, callback)
    } else {
      console.log('STATUS: max "' + options.accountName + '" addresses already generated')
      callback(true)
    }
  })
  .catch((err) => {
    if (err.code === -12) {
      AddressGenerator.runKeypoolRefill(options, callback)
    } else {
      console.log('ERROR: client.getAddressesByAccount', err)
      callback(false)
      return
    }
  })
}

AddressGenerator.generateNewAccountAddresses = (options, callback) => {
  if (options.numToGenerate <= 0) {
    callback(true)
  } else {
    options.client.getNewAddress(options.accountName).then((address) => {
      console.log('STATUS: new "' + options.accountName + '" address generated: ', address)
      AddressGenerator.generateNewAccountAddresses({
        client: options.client,
        accountName: options.accountName,
        maxAddresses: options.maxAddresses,
        numToGenerate: options.numToGenerate - 1,
      }, callback)
    })
    .catch((err) => {
      if (err.code === -12) {
        AddressGenerator.runKeypoolRefill(options, callback)
      } else {
        console.log('ERROR: client.getNewAddress', err)
        callback(false)
        return
      }
    })
  }
}

module.exports = AddressGenerator
