'use strict';

/**
 * This is the state of my IKEA script generated from Headless Recorder for all scenarios, with comments I added to make sense of what's going on.
 * I also then moved around the relevant scenarios into the large if-else block during checkout.
 * At this point, I could swap out the detail item link and this script would check if an item is in stock for me.
 */
const puppeteer = require('puppeteer');
(async () => {
  // debug mode
  const browser = await puppeteer.launch({headless: false, slowMo: 100})
  // const browser = await puppeteer.launch()
  const page = await browser.newPage()
  
  //lol debug
  page.on('console', msg => {
    if (msg.args().length == 1) {
      console.log('Console Log:', msg.text());
    } 
    else {
      for (let i = 0; i < msg.args().length; i++) {
        console.log('\tLog:', msg.args()[i]);
      }
    }
  });
  // await page.evaluate(() => console.log(`url is ${location.href}`));

  const navigationPromise = page.waitForNavigation()
  
  //await page.goto('https://www.ikea.com/us/en/p/lidhult-sofa-with-chaise-gassebol-light-beige-s59257159/')

  await page.goto('https://www.ikea.com/us/en/p/stockholm-mirror-walnut-veneer-60249960/')

  await page.setViewport({ width: 800, height: 600 })
  
  await page.waitForSelector('.js-buy-module > .range-revamp-buy-module__buttons > .range-revamp-buy-module__buttons--left > .range-revamp-btn > .range-revamp-btn__inner')
  await page.click('.js-buy-module > .range-revamp-buy-module__buttons > .range-revamp-buy-module__buttons--left > .range-revamp-btn > .range-revamp-btn__inner')
  
  await page.waitForSelector('.rec-modal > .rec-modal__content > .rec-modal__hero > .rec-added-to-cart__hero > .rec-text')
  await page.click('.rec-modal > .rec-modal__content > .rec-modal__hero > .rec-added-to-cart__hero > .rec-text')
  
  await navigationPromise
  
  await page.waitForSelector('.shoppingbag__headline > .checkout__wrapper > .checkout > .cart-ingka-btn > .cart-ingka-btn__inner')
  await page.click('.shoppingbag__headline > .checkout__wrapper > .checkout > .cart-ingka-btn > .cart-ingka-btn__inner')
  
  await navigationPromise
  
  await page.waitForSelector('.zipin #zipcode')
  await page.click('.zipin #zipcode')
  
  await page.type('.zipin #zipcode', '98109')
  
  await page.waitForSelector('.zipin > form > .\_Rfx6_ > .button > .button__text')
  await page.click('.zipin > form > .\_Rfx6_ > .button > .button__text')

  // Wait for backend network calls, we add a timeout, lack of it means element not present = out of stock
  // IKEA currently throws '500 server error' from ingka.com if all items are Out of Stock
  if (await page.waitForSelector('.Toastify__toast-container > .Toastify__toast--error > .button', {timeout: 5000}) !== null) {
    await page.click('.Toastify__toast-container > .Toastify__toast > .button')
    console.log("Out of stock :(")
  } else if (await page.waitForSelector('.homedeliveryoptions__option > .stockavailability > .stockavailability__recalculate > .button > .button__text')) {
    // on stock availability recalcuate
    await page.click('.homedeliveryoptions__option > .stockavailability > .stockavailability__recalculate > .button > .button__text')
    console.log("Some items are out of stock..."); 
  }else if (await page.waitForSelector('.homedelivery #REGULAR') !== null) {
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


// https://ordercapture.ingka.com/ordercaptureapi/us/checkouts/4ea13d62-bb43-4e66-920b-3ef966b31828/delivery-areas/d9e0aceb-fd58-4dbe-b323-a3c9a691a0fc/delivery-services

// Scenario: Item is in the cart but some are not

// const puppeteer = require('puppeteer');
// (async () => {
//   const browser = await puppeteer.launch()
//   const page = await browser.newPage()
  
//   await page.goto('https://www.ikea.com/us/en/order/delivery/')
  
//   await page.setViewport({ width: 1485, height: 921 })
  
//   await page.waitForSelector('.zipin > form > .\_Rfx6_ > .button > .button__text')
//   await page.click('.zipin > form > .\_Rfx6_ > .button > .button__text')
  
  
//   await browser.close()
// })()

