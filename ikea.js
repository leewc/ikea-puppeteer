'use strict';

/**
 * npm init
 * npm i puppeteer
 * npm i nodemailer
 */

const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const util = require('util');

const DEBUG = true;
const DETAIL_PAGE_LINKS = [
  // 'https://www.ikea.com/us/en/p/stockholm-mirror-walnut-veneer-60249960/', //test: in-stock item
  'https://www.ikea.com/us/en/p/lidhult-sofa-with-chaise-gassebol-light-beige-s59257159/', //out of stock
  // 'https://www.ikea.com/us/en/p/pax-wardrobe-frame-white-50214560/'
];
const DELIVERY_ZIP_CODE = '98109';
const INTERVAL_IN_MINUTES = 0.5;

// Generate a Gmail app password (so you do not use your real password)
// https://nodemailer.com/usage/using-gmail/
// todo Move to config
const MAIL_CREDENTIALS = {
  user: "your-email@gmail.com",
  pass: "you-app-password" // You also promise to never commit this to source control right?
}

const MAIL_DETAILS = {
  from: 'ikea-add-to-cart@leewc.com', //does not matter since gmail will swap it out
  to: 'email-receiving-notification@example.com',
  subject: '[IKEA] Item in Stock',
  beginningText: 'Puppeteer has found the following items in stock!\n\t'
};


async function main() {

  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: MAIL_CREDENTIALS
  })

  const delay = util.promisify(setTimeout);
  console.log(`[${new Date()}] Will check stock @ IKEA every ${INTERVAL_IN_MINUTES} mins.`)
  while(true) {
    // https://stackoverflow.com/a/52184527/4512948
    await delay(INTERVAL_IN_MINUTES * 60000);
    console.log(`[${new Date()}] Begin checking if [${DETAIL_PAGE_LINKS}] are in stock!`)

    let inStockLinks = [];
    // https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await
    // Feel free to change logic here to notify only when all items are in stock, ie : if (await inStock(DETAIL_PAGE_LINKS)) then sendNotificationByEmail instead of per-link
    for (const detailPageLink of DETAIL_PAGE_LINKS) {
      // I want to be notified whenever 1 item is in stock, rather than when *all* are in stock.
      if (await inStock([detailPageLink])) {
        console.log(`Yay! ${detailPageLink} is in stock!!`);
        inStockLinks.push(detailPageLink);
      }
    }
    if (inStockLinks.length > 0) {
      sendNotificationByEmail(transporter, inStockLinks);
    }
    //else sleep.
    console.log(`[${new Date()}] Sleeping for ${INTERVAL_IN_MINUTES} mins...`)
  }
}
main()

const sendNotificationByEmail = (transporter, inStockLinks) => {
  let messageBody = MAIL_DETAILS['beginningText'] + inStockLinks.concat("\n\t");
  transporter.sendMail(messageBody, function(error, info){
    if (error) {
    console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

const inStock = async (detailPageLinks) => {
  let itemFound = false;
  await (async () => {
    // debug mode
    const browser = DEBUG 
                    ? await puppeteer.launch({headless: false, slowMo: 0.5}) 
                    : await puppeteer.launch({slowMo: 0.5}); //see below for why we slow things down

    const page = await browser.newPage()
    await page.setViewport({ width: 800, height: 600 })
  
    if (DEBUG) {
      page.on('console', msg => {
        console.log(`Console Log: ${msg.text()}`);
        // Prints everything including JS Handle objects
        // for (let i = 0; i < msg.args().length; i++) {
        //     console.log(msg.args()[i]);
        // }
      });
      // await page.evaluate(() => console.log(`url is ${location.href}`));
    }
  
    const navigationPromise = page.waitForNavigation()
  
    for (const detailPageLink of detailPageLinks) {
      await page.goto(detailPageLink, {waitUntil: 'networkidle0'}) //todo talk about why https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#pagegotourl-options
      await navigationPromise
      await addToCart(page, detailPageLink)
    }
  
    console.log("All items added, checking out ....")
    await beginCheckout(page, DELIVERY_ZIP_CODE)
  
    // Here we do this unwieldly try-catch as we're not sure if the selector exists, we could wait for 'networkIdle' and try to use $ selector instead of a timeout, but that's not much better. Downside here is waiting 5 seconds regardless if item is in stock or not.
    // IKEA currently throws '500 server error' from ingka.com if all items are Out of Stock, if some of them are in-stock 'cannot add item to list'
    try {
      // There is a timing issue in which the 'toast' will pop up but Puppeteer gives up waiting, as such as must slowdown for it.
      // Alternatively, do not wait for this and instead just check if there is stock (i.e able to select 'home-delivery')
      await page.waitForSelector('.Toastify__toast-container > .Toastify__toast--error > .button', {visible: true});
      await page.click('.Toastify__toast-container > .Toastify__toast--error > .button', {visible: true})
      // await page.waitForSelector('#one-checkout > .Toastify__toast-container > .Toastify__toast--error > .button', {visible: true, timeout: 5000});
      // await page.click('#one-checkout > div.Toastify > div > div > button')
      console.log("Out of stock :(");
      await browser.close()
      return;
    } catch(error) {
      console.log('Error Element not present, trying something else. ' + error)
    }

    try {
      // Wait for backend network calls, we add a timeout, lack of it means element not present = out of stock
      await page.waitForSelector('.homedeliveryoptions__option > .stockavailability > .stockavailability__recalculate > .button > .button__text', {visible: true, timeout: 5000})
      // on stock availability recalcuate
      await page.click('.homedeliveryoptions__option > .stockavailability > .stockavailability__recalculate > .button > .button__text')
      console.log("At least one item is out of stock...");
      await browser.close()
      return;
    } catch(error) {
      console.log('Stock recalculate element not present. Moving on.')
    }

    try {
      // We have stock!
      await page.waitForSelector('.homedelivery #REGULAR', {timeout: 5000});
      await page.click('.homedelivery #REGULAR')
      console.log("!!!!!! All Items are available !!!!!!");
      await browser.close()

      // Flip to item found
      itemFound = true;
      return;
    } catch(error) {
      console.log('No home delivery element present.')
    }
    
    console.log("Unknown case.")   // throw an exception?
    await browser.close()
    console.log("All done. Exiting ... ")
    return;
  })()
  // Without this, the method will be of type () => Promise<void> and we can't do 'then' promise chaining.
  return itemFound;
} 

// https://developer.mozilla.org/en-US/docs/Glossary/IIFE
async function addToCart(page, detailPageLink) {
  // need one await here to block on this IIFE to complete.
  await (async() => {
    console.log(`Adding ${detailPageLink} to cart.`)
  
      // await page.waitForSelector('.js-buy-module > .range-revamp-buy-module__buttons > .range-revamp-buy-module__buttons--left > .range-revamp-btn > .range-revamp-btn__inner')
    await page.waitForSelector('.js-buy-module > .range-revamp-buy-module__buttons > .range-revamp-buy-module__buttons--left > .range-revamp-btn', {visible: true})
    await page.focus('.js-buy-module > .range-revamp-buy-module__buttons > .range-revamp-buy-module__buttons--left > .range-revamp-btn')
    // https://github.com/puppeteer/puppeteer/issues/1805  -- Item is loaded in the DOM but not yet rendered on the browser. Also visible region.
    // Since I'm OK with waiting, or at least networkIdle, wait. 
    // Noticed also the better way to do it works in the console of Chrome when you $('selector').click()
    // Suddently realized this function does not work due to IKEA being slow, and for the life of me not understand why it's not CLICKING!
    // await page.waitForTimeout(10000)
    // Option 3: Wait for network idle in page.goto (see above)
    // This is when i realized a better way to do it! 
    const element = await page.$('[data-test-target="add-to-cart-button"]');
    // Alternative
    // await page.click('.js-buy-module > .range-revamp-buy-module__buttons > .range-revamp-buy-module__buttons--left > .range-revamp-btn > .range-revamp-btn__inner')

    await element.click();

    // If this shows up, we managed to add to cart, aka 'Continue to Bag' should pop up
    await page.waitForSelector('.rec-modal > .rec-modal__content > .rec-modal__hero > .rec-added-to-cart__hero > .rec-text')

    console.log(`Added ${detailPageLink} to cart.`)
  })();
}

async function beginCheckout(page, deliveryZipCode) {
  await (async() => {
    const navigationPromise = page.waitForNavigation()

    // await page.click('.rec-modal > .rec-modal__content > .rec-modal__hero > .rec-added-to-cart__hero > .rec-text')
    await page.goto('https://www.ikea.com/us/en/shoppingcart/') //accomplishes the same thing as above.
    await navigationPromise

    // 'Checkout' 
    await page.waitForSelector('.shoppingbag__headline > .checkout__wrapper > button')
    await page.click('.shoppingbag__headline > .checkout__wrapper > button')

    await navigationPromise
    await page.waitForSelector('.zipin #zipcode')
    await page.click('.zipin #zipcode')
    await page.type('.zipin #zipcode', deliveryZipCode)
  
    await page.waitForSelector('.zipin > form > .\_Rfx6_ > .button > .button__text')
    await page.click('.zipin > form > .\_Rfx6_ > .button > .button__text')
  })();
}