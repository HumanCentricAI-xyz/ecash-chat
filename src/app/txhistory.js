"use client";
import React, { useState, useEffect } from 'react';
import { appConfig } from '../config/app';
import { getTxHistory, txListener } from '../chronik/chronik';
import { chronik as chronikConfig } from '../config/chronik';
import { ChronikClientNode } from 'chronik-client';
import cashaddr from 'ecashaddrjs';
import { isValidRecipient, isValidMessage } from '../validation/validation';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MagnifyingGlassIcon, ResetIcon } from "@radix-ui/react-icons";
import {
    AnonAvatar,
    ShareIcon,
    ReplyIcon,
    SearchIcon,
    ExportIcon,
    EncryptionIcon,
    DecryptionIcon,
    MoneyIcon,
} from "@/components/ui/social";
import { encodeBip21Message, encodeBip2XecTip } from '../utils/utils';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { HiInformationCircle } from "react-icons/hi";
import { Input } from "@/components/ui/input"
import { Popover, Avatar, Textarea, Alert, Modal, Card } from "flowbite-react";
import { Badge } from "@/components/ui/badge";
import { Tweet } from 'react-tweet';
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css'
import {
    TwitterShareButton,
    TwitterIcon,
    FacebookShareButton,
    FacebookIcon,
    RedditShareButton,
    RedditIcon,
    TelegramShareButton,
    TelegramIcon,
} from 'next-share';
const crypto = require('crypto');
import copy from 'copy-to-clipboard';
import { toast } from 'react-toastify';
const chronik = new ChronikClientNode(chronikConfig.urls);
import { PersonIcon } from '@radix-ui/react-icons';

export default function TxHistory({ address }) {
    const [txHistory, setTxHistory] = useState('');
    const [loadingMsg, setLoadingMsg] = useState('');
    const [txHistoryByAddress, setTxHistoryByAddress] = useState(false);
    const [addressToSearch, setAddressToSearch] = useState('');
    const [addressToSearchError, setAddressToSearchError] = useState(false);
    const [tipRecipient, setTipRecipient] = useState(false);
    const [tipRecipientAmount, setTipRecipientAmount] = useState(false);
    const [openDecryptionModal, setOpenDecryptionModal] = useState(false);
    const [decryptionInput, setDecryptionInput] = useState('');
    const [encryptedMessage, setEncryptedMessage] = useState('');
    const [currentPage, setCurrentPage] = useState(0);
    const [maxPagesToShow, setMaxPagesToShow] = useState(7); // default 7 here 

    useEffect(() => {
      const handleResize = () => {
          setMaxPagesToShow(window.innerWidth < 576 ? 5 : 7);
      };

      window.addEventListener('resize', handleResize);
      handleResize();
      return () => window.removeEventListener('resize', handleResize);
  }, []);

    const halfMaxPages = Math.floor(maxPagesToShow / 2);

    useEffect(() => {
        // Render the first page by default upon initial load
        (async () => {
            await getTxHistoryByPage(0);
        })();
        initializeHistoryRefresh();
    }, []);

    // Filters txHistory for txs where the address matches either the sender or receiver outputs
    const getTxHistoryByAddress = () => {
        if (
            Array.isArray(txHistory.txs) &&
            txHistory.txs.length > 0
        ) {
            const filteredTxHistory = [];
            for (const tx of txHistory.txs) {
                // Add this tx if this address was the sender or receiver
                if (
                    tx.replyAddress === addressToSearch ||
                    tx.recipientAddress === addressToSearch
                ) {
                    filteredTxHistory.push(tx);
                }
            }
            setTxHistoryByAddress(filteredTxHistory);
        }
    };

    /**
     * Set an interval to trigger regular history refresh
     * @returns callback function to cleanup interval
     */
    const initializeHistoryRefresh = async () => {
        const intervalId = setInterval(async function () {
            await getTxHistoryByPage(0);
        }, appConfig.historyRefreshInterval);
        // Clear the interval when page unmounts
        return () => clearInterval(intervalId);
    };

    // Retrieves the tx history specific to OP_RETURN messages
    const getTxHistoryByPage = async (page) => {
        if (
            typeof page !== "number" ||
            chronik === undefined ||
            !cashaddr.isValidCashAddress(address, 'ecash')
        ) {
            return;
        }

        const txHistoryResp = await getTxHistory(chronik, address, page);
        if (txHistoryResp && Array.isArray(txHistoryResp.txs)) {
            setTxHistory(txHistoryResp);
        }
    };

    // Validates the address being filtered for
    const handleAddressChange = e => {
        const { value } = e.target;
        if (
            isValidRecipient(value) === true &&
            value.trim() !== ''
        ) {
            setAddressToSearch(value);
            setAddressToSearchError(false);
        } else {
            setAddressToSearchError('Invalid eCash address');
        }
    };

    // Handles the input of the decryption key
    const handleDecryptionInput = e => {
        const { value } = e.target;
        // Future encryption algo selection checks here
        setDecryptionInput(value);
    };

    // Pass a message tx BIP21 query string to cashtab extensions
    const sendXecTip = (recipient, tipAmount) => {
        // Encode the op_return message script
        const opReturnRaw = encodeBip2XecTip();

        window.postMessage(
            {
                type: 'FROM_PAGE',
                text: 'Cashtab',
                txInfo: {
                    bip21: `${recipient}?amount=${tipAmount}&op_return_raw=${opReturnRaw}`,
                },
            },
            '*',
        );

        txListener(chronik, address, "XEC tip", getTxHistoryByPage);
    };

    // Decrypts the message using the provided key
    const decryptMessage = (messageToDecrypt) => {
        if (encryptedMessage === '') {
            return;
        }

        try {
            const decipher = crypto.createDecipher('aes-256-cbc', decryptionInput);
            let decryptedMessage = decipher.update(encryptedMessage, 'hex', 'utf8');
            decryptedMessage += decipher.final('utf8');
            toast(`Decrypted message: ${decryptedMessage}`);
        } catch (err) {
            toast(`Decryption error: ${err.message}`);
        }
        setEncryptedMessage('');
        setDecryptionInput('');
    };

    // Renders the tx history based on whether a filter has been applied based on address
    const RenderTxHistory = () => {
      let latestTxHistory;

      if (
          Array.isArray(txHistoryByAddress) &&
          txHistoryByAddress.length > 0
      ) {
          latestTxHistory = { txs: txHistoryByAddress };
      } else {
          latestTxHistory = txHistory;
      }

       return (
         latestTxHistory &&
           latestTxHistory.txs &&
             latestTxHistory.txs.length > 0
             ? latestTxHistory.txs.map(
                   (tx, index) => (
                     <>
                     <div className="flex flex-col items-center mt-2" key={"txHistory"+index}>
                        <div className="flex flex-col space-y-1.5 w-full max-w-xl leading-1.5 p-6 rounded-xl border bg-card text-card-foreground shadow dark:bg-gray-700 transition-transform transform">
                        <div className="flex items-center space-x-2 rtl:space-x-reverse text-sm font-semibold text-gray-900 dark:text-white break-words">
                           <span className="text-sm font-semibold text-gray-900 dark:text-gray-400">From: </span>
                           <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {tx.replyAddress === address ? (
                                  <>
                                  <div className="flex items-center gap-4">
                                      <PersonIcon/>
                                      <div className="font-medium dark:text-white">
                                          <div onClick={() => {
                                              copy(tx.replyAddress);
                                              toast(`${tx.replyAddress} copied to clipboard`);
                                          }}
                                          ><Badge variant="outline">This Wallet</Badge></div>
                                      </div>
                                  </div>
                                  </>
                              ) :
                                (<>
                                  <span>
                                  <div className="flex items-center gap-2">
                                      <PersonIcon/>
                                      <div className="font-medium dark:text-white">
                                          <div onClick={() => {
                                              copy(tx.replyAddress);
                                              toast(`${tx.replyAddress} copied to clipboard`);
                                          }}>
                                        <Badge variant="outline">
                                             {tx.replyAddress.substring(0,8)}...{tx.replyAddress.substring(tx.replyAddress.length - 5)}
                                        </Badge>
                                            
                                          </div>
                                      </div>
                                      <Popover
                                        aria-labelledby="default-popover"
                                        content={
                                          <div className="w-50 text-sm text-gray-500 dark:text-gray-400">
                                            <div className="border-b border-gray-200 bg-gray-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-700">
                                              <h3 id="default-popover" className="font-semibold text-gray-900 dark:text-white">Select Tipping Amount</h3>
                                            </div>
                                            <div className="px-3 py-2">
                                                <button
                                                  type="button"
                                                  className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                                                  onClick={e => {
                                                      sendXecTip(tx.replyAddress, 100);
                                                  }}
                                                >
                                                  100
                                                </button>
                                                &nbsp;
                                                <button
                                                  type="button"
                                                  className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                                                  onClick={e => {
                                                      sendXecTip(tx.replyAddress, 1000);
                                                  }}
                                                >
                                                  1k
                                                </button>
                                                &nbsp;
                                                <button
                                                  type="button"
                                                  className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                                                  onClick={e => {
                                                      sendXecTip(tx.replyAddress, 10000);
                                                  }}
                                                >
                                                  10k
                                                </button>
                                                &nbsp;
                                                <button
                                                  type="button"
                                                  className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                                                  onClick={e => {
                                                      sendXecTip(tx.replyAddress, 100000);
                                                  }}
                                                >
                                                  100k
                                                </button>
                                                &nbsp;
                                                <button
                                                  type="button"
                                                  className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                                                  onClick={e => {
                                                      sendXecTip(tx.replyAddress, 1000000);
                                                  }}
                                                >
                                                  1M
                                                </button>
                                            </div>
                                          </div>
                                        }
                                      >
                                        <button
                                            type="button"
                                            className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                                        >
                                            Tip
                                        </button>
                                      </Popover>
                                    </div>
                                  </span>
                                </>)
                              }
                           </span>
                           <span className="text-sm font-semibold text-gray-900 dark:text-gray-400">&emsp;&emsp;To: </span>
                           <span className="text-sm font-semibold text-gray-900 dark:text-white">
                               {tx.recipientAddress === address ? (
                                    <>
                                        <div className="flex items-center gap-4">
                                            <PersonIcon/>
                                            <div className="font-medium dark:text-white"
                                                onClick={() => {
                                                   copy(tx.recipientAddress);
                                                   toast(`${tx.recipientAddress} copied to clipboard`);
                                                }}
                                            >
                                                <div><Badge variant="outline">This Wallet</Badge></div>
                                            </div>
                                        </div>
                                    </>
                               ) : tx.iseCashChatPost === true ? <Badge variant="outline">eCash Chat Townhall</Badge> :
                                 (<>
                                   <span>
                                   <div className="flex items-center gap-4">
                                       <PersonIcon/>
                                       <div className="font-medium dark:text-white">
                                           <div onClick={() => {
                                               copy(tx.recipientAddress);
                                               toast(`${tx.recipientAddress} copied to clipboard`);
                                           }}>
                                            <Badge variant="outline">
                                            {tx.recipientAddress.substring(0,8)}...{tx.recipientAddress.substring(tx.recipientAddress.length - 5)}
                                           </Badge>
                                              
                                          </div>
                                       </div>
                                       <Popover
                                         aria-labelledby="default-popover"
                                         content={
                                           <div className="w-50 text-sm text-gray-500 dark:text-gray-400">
                                             <div className="border-b border-gray-200 bg-gray-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-700">
                                               <h3 id="default-popover" className="font-semibold text-gray-900 dark:text-white">Select Tipping Amount</h3>
                                             </div>
                                             <div className="px-3 py-2">
                                                 <button
                                                   type="button"
                                                   className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                                                   onClick={e => {
                                                       sendXecTip(tx.recipientAddress, 100);
                                                   }}
                                                 >
                                                   100
                                                 </button>
                                                 &nbsp;
                                                 <button
                                                   type="button"
                                                   className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                                                   onClick={e => {
                                                       sendXecTip(tx.recipientAddress, 1000);
                                                   }}
                                                 >
                                                   1k
                                                 </button>
                                                 &nbsp;
                                                 <button
                                                   type="button"
                                                   className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                                                   onClick={e => {
                                                       sendXecTip(tx.recipientAddress, 10000);
                                                   }}
                                                 >
                                                   10k
                                                 </button>
                                                 &nbsp;
                                                 <button
                                                   type="button"
                                                   className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                                                   onClick={e => {
                                                       sendXecTip(tx.recipientAddress, 100000);
                                                   }}
                                                 >
                                                   100k
                                                 </button>
                                                 &nbsp;
                                                 <button
                                                   type="button"
                                                   className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                                                   onClick={e => {
                                                       sendXecTip(tx.recipientAddress, 1000000);
                                                   }}
                                                 >
                                                   1M
                                                 </button>
                                             </div>
                                           </div>
                                         }
                                       >
                                         <button
                                             type="button"
                                             className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                                         >
                                             Tip
                                         </button>
                                       </Popover>
                                    </div>
                                   </span>
                                 </>)
                               }
                           </span>
                        </div>

                        {/* Render the op_return message */}
                        <br />
                        {tx.isEcashChatEncrypted ? (
                            <>
                                <Alert color="failure" icon={HiInformationCircle}>
                                    &nbsp;&nbsp;<b>Encrypted Message</b><br />
                                    &nbsp;&nbsp;{tx.opReturnMessage ? `${tx.opReturnMessage}`.substring(0,40)+'...' : ' '}
                                </Alert>
                            </>
                            ) : (
                                <p className="text-sm font-normal py-2.5 text-gray-900 dark:text-white text-ellipsis break-words min-w-0" key={index}>{tx.opReturnMessage ? `${tx.opReturnMessage}` : ' '}</p>
                            )
                        }

                        {/* XEC Tip rendering */}
                        {tx.isXecTip && (
                          <Alert color="success">
                              <div className="flex items-center space-x-2">
                                  <MoneyIcon className="h-5 w-5 text-blue-500" />
                                  <span>
                                      {tx.recipientAddress === address ? 
                                          `Received ${tx.xecAmount} XEC tip from eCash Chat` :
                                          `Sent ${tx.xecAmount} XEC tip via eCash Chat`
                                      }
                                  </span>
                              </div>
                          </Alert>
                      )}

                        {/* Render any media content within the message */}
                        {tx.nftShowcaseId !== false && tx.nftShowcaseId !== undefined && (
                          <>
                              <Card href={`${appConfig.blockExplorerUrl}/tx/${tx.nftShowcaseId}`} target="_blank" className="max-w-sm">
                                  <b>NFT Showcase</b>
                                      <div className="font-medium dark:text-white">
                                          <div onClick={() => {
                                              copy(tx.nftShowcaseId);
                                              toast(`${tx.nftShowcaseId} copied to clipboard`);
                                          }}>
                                              ID: {tx.nftShowcaseId.substring(0,15)}...{tx.nftShowcaseId.substring(tx.nftShowcaseId.length - 10)}
                                          </div>
                                          Last sale price: N/A<br /><br />
                                      </div>
                                  <img src={`${appConfig.tokenIconsUrl}/256/${tx.nftShowcaseId}.png`} className="rounded-lg object-cover"/>
                              </Card>
                          </>
                        )}
                        {tx.imageSrc !== false && (<img src={tx.imageSrc} />)}
                        {tx.videoId !== false && (<LiteYouTubeEmbed id={tx.videoId} />)}
                        {tx.tweetId !== false && (<Tweet id={tx.tweetId} />)}
                        {tx.url !== false && (<Alert color="info"><a href={tx.url} target="_blank" >{tx.url}</a></Alert>)}

                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                            {tx.isCashtabMessage ? 'Cashtab Message' :
                                tx.iseCashChatMessage ? 'eCash Chat Message' :
                                    tx.iseCashChatPost ? 'eCash Townhall Post' :
                                        'External Message'
                            }

                            {/* Date and timestamp */}
                            &nbsp;|&nbsp;{tx.txDate}&nbsp;at&nbsp;{tx.txTime}

                            &nbsp;|&nbsp;{tx.xecAmount} XEC
                        </span>

                        <div className="flex py-3">
                            {/* Decryption and share buttons */}
                            <br />
                            {tx.isEcashChatEncrypted && (
                                <>
                                    {/* Decryption modal */}
                                    <Modal show={openDecryptionModal} onClose={() => {
                                            setOpenDecryptionModal(false)
                                            setDecryptionInput('')
                                        }}
                                    >
                                        <Modal.Header><div className="flex"><DecryptionIcon />&nbsp;Decrypt Message</div></Modal.Header>
                                        <Modal.Body>
                                            <div className="space-y-6">
                                              <p className="text-base leading-relaxed text-gray-500 dark:text-gray-400">
                                                  Please input the password used by the sender to decrypt this message.
                                              </p>
                                              <p>
                                                  <Alert>{tx.opReturnMessage}</Alert>
                                              </p>
                                              <p className="text-base leading-relaxed text-gray-500 dark:text-gray-400">
                                                  {/* Decryption input */}
                                                  <Input
                                                    id="decryptionKey"
                                                    name="decryptionKey"
                                                    type="text"
                                                    defaultValue={decryptionInput}
                                                    onBlur={e => handleDecryptionInput(e)}
                                                  />
                                                  <br />
                                                  <button disabled={decryptionInput === ''} onClick={() => {
                                                      decryptMessage(tx.opReturnMessage)
                                                      setOpenDecryptionModal(false)
                                                  }} className="rounded bg-blue-500 px-2 py-1 text-m font-semibold text-white shadow-sm hover:bg-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
                                                      Decrypt
                                                  </button>
                                              </p>
                                            </div>
                                        </Modal.Body>
                                    </Modal>
                                    <button type="button" onClick={() => {
                                        setEncryptedMessage(tx.opReturnMessage);
                                        setOpenDecryptionModal(true)
                                    }}>
                                        <DecryptionIcon />
                                    </button>
                                </>
                            )}

                            &nbsp;

                            <Popover
                              aria-labelledby="default-popover"
                              placement="top"
                              content={
                                <div className="w-30 text-sm text-gray-500 dark:text-gray-400">
                                  <div className="border-b border-gray-200 bg-gray-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-700">
                                    <h3 id="default-popover" className="font-semibold text-gray-900 dark:text-white">Select Platform</h3>
                                  </div>
                                  <div className="px-3 py-2">
                                      <TwitterShareButton
                                        url={
                                            tx.imageSrc !== false ? tx.imageSrc
                                                : tx.videoId !== false ? `https://www.youtube.com/watch?v=${tx.videoId}`
                                                : tx.tweetId !== false ? `https://twitter.com/i/web/status/${tx.tweetId}`
                                                : 'https://ecashchat.com'
                                        }
                                        title={`[Shared from eCashChat.com] - ${tx.opReturnMessage}`}
                                      >
                                        <TwitterIcon size={25} round />
                                      </TwitterShareButton>
                                      &nbsp;
                                      <FacebookShareButton
                                        url={
                                            tx.imageSrc !== false ? tx.imageSrc
                                                : tx.videoId !== false ? `https://www.youtube.com/watch?v=${tx.videoId}`
                                                : tx.tweetId !== false ? `https://twitter.com/i/web/status/${tx.tweetId}`
                                                : 'https://ecashchat.com'
                                        }
                                        quote={`[Shared from eCashChat.com] - ${tx.opReturnMessage}`}
                                      >
                                        <FacebookIcon  size={25} round />
                                      </FacebookShareButton>
                                      &nbsp;
                                      <RedditShareButton
                                        url={
                                            tx.imageSrc !== false ? tx.imageSrc
                                                : tx.videoId !== false ? `https://www.youtube.com/watch?v=${tx.videoId}`
                                                : tx.tweetId !== false ? `https://twitter.com/i/web/status/${tx.tweetId}`
                                                : 'https://ecashchat.com'
                                        }
                                        title={`[Shared from eCashChat.com] - ${tx.opReturnMessage}`}
                                      >
                                        <RedditIcon size={25} round />
                                      </RedditShareButton>
                                      &nbsp;
                                      <TelegramShareButton
                                        url={
                                            tx.imageSrc !== false ? tx.imageSrc
                                                : tx.videoId !== false ? `https://www.youtube.com/watch?v=${tx.videoId}`
                                                : tx.tweetId !== false ? `https://twitter.com/i/web/status/${tx.tweetId}`
                                                : 'https://ecashchat.com'
                                        }
                                        title={`[Shared from eCashChat.com] - ${tx.opReturnMessage}`}
                                      >
                                        <TelegramIcon  size={25} round />
                                      </TelegramShareButton>
                                  </div>
                                </div>
                              }
                            >
                              <button type="button">
                                  <ShareIcon />
                              </button>
                            </Popover>
                        </div>
                     </div>
                    </div>
                    </>
                   ),
               )
             : `No messages in this range of transactions.`
       );
    }

    return (
         <>
         <div className="flex min-h-full flex-1 flex-col justify-center px-4 sm:px-6 lg:px-8 w-full lg:min-w-[576px] min-w-96">
         {txHistory && txHistory !== '' ? (
             <>
             {/*Set up pagination menu*/}
  
             <span>
             <Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious
        href="#"
        onClick={(e) => {
          setCurrentPage((old) => Math.max(0, old - 1));
          getTxHistoryByPage(Math.max(0, currentPage - 1));
        }}
        disabled={currentPage === 0}
      />
    </PaginationItem>

    {Array.from({ length: txHistory.numPages }, (_, i) => i)
      .filter(i => {
      
        if (txHistory.numPages <= maxPagesToShow) return true;
        if (currentPage <= halfMaxPages) return i < maxPagesToShow;
        if (currentPage >= txHistory.numPages - halfMaxPages) return i >= txHistory.numPages - maxPagesToShow;
        return i >= currentPage - halfMaxPages && i <= currentPage + halfMaxPages;
      })
      .map(i => (
        <PaginationItem key={i}>
          <PaginationLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              getTxHistoryByPage(i);
              setCurrentPage(i);
            }}
            isActive={currentPage === i}
          >
            {i + 1}
          </PaginationLink>
        </PaginationItem>
      ))}

    <PaginationItem>
      <PaginationNext
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setCurrentPage((old) => Math.min(txHistory.numPages - 1, old + 1));
          getTxHistoryByPage(Math.min(txHistory.numPages - 1, currentPage + 1));
        }}
        disabled={currentPage === txHistory.numPages - 1}
      />
    </PaginationItem>
  </PaginationContent>
</Pagination>
               </span>
             <form className="space-y-6" action="#" method="POST">
  <div>
  <div className="mt-10 flex flex-col items-center">
  <div className="flex items-center space-x-2">
    <input
      id="address"
      name="address"
      type="text"
      value={addressToSearch}
      required
      placeholder='Search By Address'
      className="flex-1 max-w-96 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
      onChange={e => handleAddressChange(e)}
    />

    <Button
      type="button"
      variant="outline"
      disabled={addressToSearchError}
      onClick={e => {
        getTxHistoryByAddress(e);
      }}
    >
      <MagnifyingGlassIcon className="h-4 w-4" />
    </Button>

    <Button
      type="button"
      variant="outline"
      onClick={() => {
        setTxHistoryByAddress('');
        setAddressToSearch('');
      }}
    >
      <ResetIcon />
    </Button>
  </div>
  <p className="mt-2 text-sm text-red-600 dark:text-red-500">
    {addressToSearchError !== false && addressToSearchError}
  </p>
</div>
  </div>
</form>
             <RenderTxHistory />
             </>
           ) : 
           <div className="flex flex-col space-y-3">
           <div className="space-y-2">
             <Skeleton className="h-4 w-[400px]" />
             <Skeleton className="h-4 w-[350px]" />
             <Skeleton className="h-4 w-[300px]" />
           </div>
         </div>
         }
         </div>    
      </>
    );
}
