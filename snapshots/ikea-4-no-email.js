'use strict';

const puppeteer = require('puppeteer');
const util = require('util');

const DETAIL_PAGE_LINKS = [
  // 'https://www.ikea.com/us/en/p/stockholm-mirror-walnut-veneer-60249960/', //in-stock item
  'https://www.ikea.com/us/en/p/lidhult-sofa-with-chaise-gassebol-light-beige-s59257159/' //out of stock
];
const DELIVERY_ZIP_CODE = '98109';
const INTERVAL_IN_MINUTES = 1;

const DEBUG = false;

async function main() {
  const delay = util.promisify(setTimeout);
  console.log(`[${new Date()}] Will check stock @ IKEA every ${INTERVAL_IN_MINUTES} mins.`)
  while(true) {
    // https://stackoverflow.com/a/52184527/4512948
    await delay(INTERVAL_IN_MINUTES * 60000);
    console.log(`[${new Date()}] Begin checking if [${DETAIL_PAGE_LINKS}] are in stock!`)
    // https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await
    if (await inStock() === true) {
      console.log("Yay! ALL Items are in stock!!")
      // send an email.
    } //else sleep.
    console.log(`[${new Date()}] Sleeping for ${INTERVAL_IN_MINUTES} mins...`)
  }
}
main()


const inStock = async () => {
  let itemFound = false;
  await (async () => {
    // debug mode
    const browser = await puppeteer.launch({headless: false, slowMo: 50})
    // const browser = await puppeteer.launch()
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
  
    for (const detailPageLink of DETAIL_PAGE_LINKS) {
      await page.goto(detailPageLink, {waitUntil: 'networkidle0'}) //todo talk about why https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#pagegotourl-options
      await navigationPromise
      await addToCart(page, detailPageLink)
    }
  
    console.log("All items added, checking out ....")
    await beginCheckout(page, DELIVERY_ZIP_CODE)
  
    // Here we do this unwieldly try-catch as we're not sure if the selector exists, we could wait for 'networkIdle' and try to use $ selector instead of a timeout, but that's not much better. Downside here is waiting 5 seconds regardless if item is in stock or not.
    // IKEA currently throws '500 server error' from ingka.com if all items are Out of Stock, if some of them are in-stock 'cannot add item to list'
    try {
      await page.waitForSelector('.Toastify__toast-container > .Toastify__toast--error > .button', {timeout: 5000});
      await page.click('.Toastify__toast-container > .Toastify__toast > .button')
      console.log("Out of stock :(");
      await browser.close()
      return;
    } catch(error) {
      console.log('Error Element not present, trying something else. ')
    }

    try {
      // Wait for backend network calls, we add a timeout, lack of it means element not present = out of stock
      await page.waitForSelector('.homedeliveryoptions__option > .stockavailability > .stockavailability__recalculate > .button > .button__text', {timeout: 5000})
      // on stock availability recalcuate
      await page.click('.homedeliveryoptions__option > .stockavailability > .stockavailability__recalculate > .button > .button__text')
      console.log("At least one item is out of stock...");
      await browser.close()
      return;
    } catch(error) {
      console.log('Stock recalculate element not present. Moving on.')
    }

    try {
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
    await page.waitForSelector('.shoppingbag__headline > .checkout__wrapper > .checkout > .cart-ingka-btn > .cart-ingka-btn__inner')
    await page.click('.shoppingbag__headline > .checkout__wrapper > .checkout > .cart-ingka-btn > .cart-ingka-btn__inner')
  
    await navigationPromise
    await page.waitForSelector('.zipin #zipcode')
    await page.click('.zipin #zipcode')
    await page.type('.zipin #zipcode', deliveryZipCode)
  
    await page.waitForSelector('.zipin > form > .\_Rfx6_ > .button > .button__text')
    await page.click('.zipin > form > .\_Rfx6_ > .button > .button__text')
  })();
}