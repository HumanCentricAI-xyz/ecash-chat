export const opReturn = {
    opReturnPrefixHex: '6a',
    opReturnPrefixDec: '106',
    opPushDataOne: '4c',
    appPrefixesHex: {
        eToken: '534c5000',
        cashtab: '00746162',
        cashtabEncrypted: '65746162', // Preserve here for use in tx processing
        airdrop: '64726f70',
        aliasRegistration: '2e786563',
        paybutton: '50415900',
        eCashChat: '63686174',
    },
    /* The max payload per spec is 220 bytes (or 223 bytes including +1 for OP_RETURN and +2 for pushdata opcodes)
       Within this 223 bytes, transaction building will take up 8 bytes, hence cashtabMsgByteLimit is set to 215 bytes
       i.e.
        6a
        04
        [prefix byte]
        [prefix byte]
        [prefix byte]
        [prefix byte]
        4c [next byte is pushdata byte]
        [pushdata byte] (d7 for 215 on a max-size Cashtab msg)
    */
    cashtabMsgByteLimit: 215,
    // townhallPostByteLimit = cashtabMsgByteLimit - pushdata byte (1 byte) - eCashChat prefix (4 bytes)
    townhallPostByteLimit: 210,
    // townhallPostByteLimit = cashtabMsgByteLimit - pushdata byte (1 byte)
    //      - eCashChat reply prefix (4 bytes) - pushdata byte (1 byte) - replyTxid (32 bytes)
    townhallReplyPostByteLimit: 177,
    townhallPostPrefixHex: '706f7374',
    townhallReplyPostPrefixHex: '68617368',
    encryptedMessagePrefixHex: '70617373',
    // Airdrop spec is <OP_RETURN> <Airdrop protocol identifier> <tokenId> <optionalMsg>
    // in bytes, = 1 + (1 + 4) + (1 + 32) + (1 or 2 + LIMIT)
    // airdropMsgByteLimit = 182 = 223 - 1 - 5 - 33 - 2
    airdropMsgByteLimit: 182,
    opreturnParamByteLimit: 222,
};
