'use strict';

const puppeteer = require('puppeteer');

const DETAIL_PAGE_LINKS = [
  // 'https://www.ikea.com/us/en/p/stockholm-mirror-walnut-veneer-60249960/', //in-stock item
  'https://www.ikea.com/us/en/p/lidhult-sofa-with-chaise-gassebol-light-beige-s59257159/' //out of stock
];
const DELIVERY_ZIP_CODE = '98109';

const DEBUG = false;

(async () => {
  // debug mode
  const browser = await puppeteer.launch({headless: false, slowMo: 50})
  // const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.setViewport({ width: 800, height: 600 })

  if (DEBUG) {
    page.on('console', msg => {
      console.log(`Console Log: ${msg.text()}`);
      // Prints everything including JS Handle
      // for (let i = 0; i < msg.args().length; i++) {
      //     console.log(msg.args()[i]);
      // }
    });
    // await page.evaluate(() => console.log(`url is ${location.href}`));
  }

  const navigationPromise = page.waitForNavigation()

  for (const detailPageLink of DETAIL_PAGE_LINKS) {
    await page.goto(detailPageLink, {waitUntil: 'networkidle0'}) //talk about why https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#pagegotourl-options
    await navigationPromise
    await addToCart(page, detailPageLink)
  }

  console.log("All added, checking out ....")
  await beginCheckout(page, DELIVERY_ZIP_CODE)

  // IKEA currently throws '500 server error' from ingka.com if all items are Out of Stock, if some of them are in-stock 'cannot add item to list'
  if (await page.waitForSelector('.Toastify__toast-container > .Toastify__toast--error > .button', {timeout: 5000})
  .catch((e) => {
    console.log('Timeout? ' + e)
  }) !== null) {
    await page.click('.Toastify__toast-container > .Toastify__toast > .button')
    console.log("Out of stock :(");
  }
  // Wait for backend network calls, we add a timeout, lack of it means element not present = out of stock
  else if (await page.waitForSelector('.homedeliveryoptions__option > .stockavailability > .stockavailability__recalculate > .button > .button__text', {timeout: 5000}).catch((e) => {
    console.log('Timeout? ' + e)
    }) !== null) {
    // on stock availability recalcuate
    await page.click('.homedeliveryoptions__option > .stockavailability > .stockavailability__recalculate > .button > .button__text')
    console.log("Some items are out of stock...");
  } else if (await page.waitForSelector('.homedelivery #REGULAR') !== null) {

    await page.click('.homedelivery #REGULAR')
    console.log("!!!!!! Item is available!!!");

    await page.waitForSelector('#flow-start > .checkout-section-sleeve > .inline-message > div > .inline-message__text')
    await page.click('#flow-start > .checkout-section-sleeve > .inline-message > div > .inline-message__text')
    
    await page.waitForSelector('.deliveryarrangements > .deliveryarrangement > .calendar > #calendar__toggle-54815 > .button__text')
    await page.click('.deliveryarrangements > .deliveryarrangement > .calendar > #calendar__toggle-54815 > .button__text')
    
    await page.waitForSelector('.deliveryarrangements > .deliveryarrangement > .calendar > #calendar__toggle-54815 > .button__text')
    await page.click('.deliveryarrangements > .deliveryarrangement > .calendar > #calendar__toggle-54815 > .button__text')

    await page.waitForSelector('#flow-start > .checkout-section-sleeve > .delivery__submit > .button > .button__text')
    await page.click('#flow-start > .checkout-section-sleeve > .delivery__submit > .button > .button__text')
    //send email or notification
  } else {
    console.log("Unknown case.")
    // throw an exception?
  }
  // await browser.close()
})()

// https://developer.mozilla.org/en-US/docs/Glossary/IIFE
async function addToCart(page, detailPageLink) {
  // need one await here to 'block'
  await (async() => {
    console.log("Going to add to cart")
  
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

    console.log(`!!! Added ${detailPageLink} to cart !!!`)
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