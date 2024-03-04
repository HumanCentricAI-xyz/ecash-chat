// Chronik methods
import { chronik as chronikConfig } from '../config/chronik';
import cashaddr from 'ecashaddrjs';
import { opReturn as opreturnConfig } from '../config/opreturn';
import { appConfig } from '../config/app';
import { getStackArray } from 'ecash-script';
import { BN } from 'slp-mdm';

export const getTxHistory = async (chronik, address, page = 0) => {
    if (
        chronik === undefined ||
        !cashaddr.isValidCashAddress(address, 'ecash')
    ) {
        return;
    }
  
    let txHistoryPage;
    try {
        txHistoryPage = await chronik.address(address).history(page, chronikConfig.txHistoryPageSize);

        const parsedTxs = [];
        for (let i = 0; i < txHistoryPage.txs.length; i += 1) {
            const parsedTx = parseChronikTx(
                txHistoryPage.txs[i],
                address,
            );
            parsedTxs.push(parsedTx);
        }

        // Filter out eToken and non-message txs
        const parsedAndFilteredTxs = parsedTxs.filter(function (el) {
          return el.isEtokenTx === false &&
                 el.opReturnMessage !== ''
        });
        return {
            txs: parsedAndFilteredTxs,
            numPages: txHistoryPage.numPages,
        };
    } catch (err) {
        console.log(`Error in getTxHistory(${address})`, err);
    }
};

export const parseChronikTx = (tx, address) => {
    const { hash } = cashaddr.decode(address, true);
    const { inputs, outputs } = tx;
    // Assign defaults
    let incoming = true;
    let xecAmount = new BN(0);
    let etokenAmount = new BN(0);
    let isTokenBurn = false;
    let isEtokenTx = tx.tokenEntries.length > 0;
    const isGenesisTx =
        isEtokenTx &&
        tx.tokenEntries &&
        tx.tokenEntries[0].txType === 'GENESIS';

    // Initialize required variables
    let airdropFlag = false;
    let airdropTokenId = '';
    let opReturnMessage = '';
    let isCashtabMessage = false;
    let isEncryptedMessage = false;
    let replyAddress = '';
    let aliasFlag = false;

    if (tx.isCoinbase) {
        // Note that coinbase inputs have `undefined` for `thisInput.outputScript`
        incoming = true;
        replyAddress = 'N/A';
    } else {
        // If this is an etoken tx, check for token burn
        if (
            isEtokenTx &&
            new BN(tx.tokenEntries[0].actualBurnAmount).isGreaterThan(0)
        ) {
            // Assume that any eToken tx with a burn is a burn tx
            isTokenBurn = true;
            try {
                const thisEtokenBurnAmount = new BN(tx.tokenEntries[0].actualBurnAmount);

                // Need to know the total output amount to compare to total input amount and tell if this is a burn transaction
                etokenAmount = etokenAmount.plus(thisEtokenBurnAmount);
            } catch (err) {
                // do nothing
                // If this happens, the burn amount will render wrong in tx history because we don't have the info in chronik
                // This is acceptable
            }
        }

        /* 
        Assume the first input is the originating address
        
        https://en.bitcoin.it/wiki/Script for reference
        
        Assume standard pay-to-pubkey-hash tx        
        scriptPubKey: OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
        76 + a9 + 14 = OP_DUP + OP_HASH160 + 14 Bytes to push
        88 + ac = OP_EQUALVERIFY + OP_CHECKSIG

        So, the hash160 we want will be in between '76a914' and '88ac'
        ...most of the time ;)
        */

        // Since you may have more than one address in inputs, assume the first one is the replyAddress
        try {
            replyAddress = cashaddr.encodeOutputScript(
                tx.inputs[0].outputScript,
            );
        } catch (err) {
            console.log(
                `Error from cashaddr.encodeOutputScript(${tx.inputs[0].outputScript})`,
                err,
            );
            // If the transaction is nonstandard, don't worry about a reply address for now
            replyAddress = 'N/A';
        }


        if (
            typeof tx.inputs[0].outputScript !== 'undefined' &&
            tx.inputs[0].outputScript.includes(hash)
        ) {
            // Then this is an outgoing tx
            incoming = false;
        }
    }

    // Iterate over outputs to get the amount sent
    for (let i = 0; i < tx.outputs.length; i += 1) {
        const thisOutput = tx.outputs[i];
        const thisOutputReceivedAtHash160 = thisOutput.outputScript;

        if (
            thisOutputReceivedAtHash160.startsWith(
                opreturnConfig.opReturnPrefixHex,
            )
        ) {
            // If this is an OP_RETURN output, parse it
            const stackArray = getStackArray(thisOutputReceivedAtHash160);

            const lokad = stackArray[0];
            switch (lokad) {
                case opreturnConfig.appPrefixesHex.airdrop: {
                    // this is to facilitate special Cashtab-specific cases of airdrop txs, both with and without msgs
                    // The UI via Tx.js can check this airdropFlag attribute in the parsedTx object to conditionally render airdrop-specific formatting if it's true
                    airdropFlag = true;
                    // index 0 is drop prefix, 1 is the token Id, 2 is msg prefix, 3 is msg
                    airdropTokenId =
                        stackArray.length >= 2 ? stackArray[1] : 'N/A';

                    // Legacy airdrops used to add the Cashtab Msg lokad before a msg
                    if (stackArray.length >= 3) {
                        // If there are pushes beyond the token id, we have a msg
                        isCashtabMessage = true;
                        if (
                            stackArray[2] ===
                                opreturnConfig.appPrefixesHex.cashtab &&
                            stackArray.length >= 4
                        ) {
                            // Legacy airdrops also pushed hte cashtab msg lokad before the msg
                            opReturnMessage = Buffer.from(stackArray[3], 'hex');
                        } else {
                            opReturnMessage = Buffer.from(stackArray[2], 'hex');
                        }
                    }
                    break;
                }
                case opreturnConfig.appPrefixesHex.cashtab: {
                    isCashtabMessage = true;
                    if (stackArray.length >= 2) {
                        opReturnMessage = Buffer.from(stackArray[1], 'hex');
                    } else {
                        opReturnMessage = 'off-spec Cashtab Msg';
                    }
                    break;
                }
                case opreturnConfig.appPrefixesHex.cashtabEncrypted: {
                    // Encrypted Cashtab msgs are deprecated, set a standard msg
                    isCashtabMessage = true;
                    isEncryptedMessage = true;
                    opReturnMessage = 'Encrypted Cashtab Msg';
                    break;
                }
                case opreturnConfig.appPrefixesHex.aliasRegistration: {
                    aliasFlag = true;
                    if (stackArray.length >= 3) {
                        opReturnMessage = Buffer.from(stackArray[2], 'hex');
                    } else {
                        opReturnMessage = 'off-spec alias registration';
                    }
                    break;
                }
                case opreturnConfig.appPrefixesHex.paybutton: {
                    // Paybutton tx
                    // For now, Cashtab only supports version 0 PayButton txs
                    // ref doc/standards/paybutton.md
                    // https://github.com/Bitcoin-ABC/bitcoin-abc/blob/master/doc/standards/paybutton.md

                    // <lokad> <version> <data> <paymentId>

                    if (stackArray.length !== 4) {
                        opReturnMessage = 'off-spec PayButton tx';
                        break;
                    }
                    if (stackArray[1] !== '00') {
                        opReturnMessage = `Unsupported version PayButton tx: ${stackArray[1]}`;
                        break;
                    }
                    const dataHex = stackArray[2];
                    const nonceHex = stackArray[3];

                    opReturnMessage = `PayButton${
                        nonceHex !== '00' ? ` (${nonceHex})` : ''
                    }${
                        dataHex !== '00'
                            ? `: ${Buffer.from(dataHex, 'hex').toString()}`
                            : ''
                    }`;
                    break;
                }
                default: {
                    // utf8 decode
                    opReturnMessage = Buffer.from(
                        thisOutputReceivedAtHash160,
                        'hex',
                    );

                    break;
                }
            }
            // Continue to the next output, we do not need to parse values for OP_RETURN outputs
            continue;
        }
        // Find amounts at your wallet's address
        if (thisOutputReceivedAtHash160.includes(hash)) {
            // If incoming tx, this is amount received by the user's wallet
            // if outgoing tx (incoming === false), then this is a change amount
            const thisOutputAmount = new BN(thisOutput.value);
            xecAmount = incoming
                ? xecAmount.plus(thisOutputAmount)
                : xecAmount.minus(thisOutputAmount);

            // Parse token qty if token tx
            // Note: edge case this is a token tx that sends XEC to Cashtab recipient but token somewhere else
            if (isEtokenTx && !isTokenBurn) {
                try {
                    const thisEtokenAmount = new BN(
                        thisOutput.token.amount,
                    );

                    etokenAmount =
                        incoming || isGenesisTx
                            ? etokenAmount.plus(thisEtokenAmount)
                            : etokenAmount.minus(thisEtokenAmount);
                } catch (err) {
                    // edge case described above; in this case there is zero eToken value for this Cashtab recipient in this output, so add 0
                    etokenAmount.plus(new BN(0));
                }
            }
        }

        // Output amounts not at your wallet are sent amounts if !incoming
        // Exception for eToken genesis transactions
        if (!incoming) {
            const thisOutputAmount = new BN(thisOutput.value);
            xecAmount = xecAmount.plus(thisOutputAmount);
            if (isEtokenTx && !isGenesisTx && !isTokenBurn) {
                try {
                    const thisEtokenAmount = new BN(thisOutput.token.amount);
                    etokenAmount = etokenAmount.plus(thisEtokenAmount);
                } catch (err) {
                    // NB the edge case described above cannot exist in an outgoing tx
                    // because the eTokens sent originated from this wallet
                }
            }
        }
    }

    /* If it's an eToken tx that 
        - did not send any eTokens to the receiving Cashtab wallet
        - did send XEC to the receiving Cashtab wallet
       Parse it as an XEC received tx
       This type of tx is created by this swap wallet. More detailed parsing to be added later as use case is better understood
       https://www.youtube.com/watch?v=5EFWXHPwzRk
    */
    if (isEtokenTx && etokenAmount.isEqualTo(0)) {
        isEtokenTx = false;
        opReturnMessage = '';
    }
    // Convert from sats to XEC
    xecAmount = xecAmount.shiftedBy(-1 * appConfig.cashDecimals);

    // Convert from BigNumber to string
    xecAmount = xecAmount.toString();

    // Get decimal info for correct etokenAmount
    let genesisInfo = {};

    // Convert opReturnMessage to string
    opReturnMessage = Buffer.from(opReturnMessage).toString();

    if (isEtokenTx) {
        // Get token genesis info from cache
        let decimals = 0;
        try {
            genesisInfo = tx.tokenEntries[0];
            if (genesisInfo.txType === 'GENESIS') {
                genesisInfo.success = true;
            } else {
                genesisInfo = { success: false };
            }
        } catch (err) {
            console.log(
                `Error getting token info from cache in parseChronikTx for ${tx.txid}`,
                err,
            );
            // To keep this function synchronous, do not get this info from the API if it is not in cache
            // Instead, return a flag so that useWallet.js knows and can fetch this info + add it to cache
            genesisInfo = { success: false };
        }
    }
    etokenAmount = etokenAmount.toString();

    // Return eToken specific fields if eToken tx
    if (isEtokenTx) {
        return {
            numPages: tx.numPages,
            incoming,
            xecAmount,
            isEtokenTx,
            etokenAmount,
            isTokenBurn,
            genesisInfo,
            airdropFlag,
            airdropTokenId,
            opReturnMessage: '',
            isCashtabMessage,
            isEncryptedMessage,
            replyAddress,
        };
    }
    // Otherwise do not include these fields
    return {
        numPages: tx.numPages,
        incoming,
        xecAmount,
        isEtokenTx,
        airdropFlag,
        airdropTokenId,
        opReturnMessage,
        isCashtabMessage,
        isEncryptedMessage,
        replyAddress,
        aliasFlag,
    };
};
