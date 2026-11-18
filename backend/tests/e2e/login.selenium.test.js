// Teste de interface com Selenium: abre o site num Chrome headless e testa a tela de login.
// Rode com o servidor no ar: APP_URL=http://localhost:3000 npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
let driver;

before(async () => {
  const opcoes = new chrome.Options().addArguments('--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900');
  driver = await new Builder().forBrowser('chrome').setChromeOptions(opcoes).build();
});

after(async () => {
  if (driver) await driver.quit();
});

test('a página inicial abre com o título e o formulário de login', async () => {
  await driver.get(APP_URL);
  assert.equal(await driver.getTitle(), 'Concurseiros Conecta');
  const form = await driver.wait(until.elementLocated(By.id('form-login')), 10000);
  assert.ok(await form.isDisplayed());
});

test('login com senha errada mostra mensagem de erro na tela', async () => {
  await driver.get(APP_URL);
  await driver.wait(until.elementLocated(By.id('login-email')), 10000);
  await driver.findElement(By.id('login-email')).sendKeys('ninguem@teste.com');
  await driver.findElement(By.id('login-senha')).sendKeys('senhaerrada123');
  await driver.findElement(By.css('#form-login button[type="submit"]')).click();
  const msg = await driver.findElement(By.id('msg-login'));
  await driver.wait(async () => (await msg.getText()).trim().length > 0, 10000);
  // A mensagem tem que vir do servidor. Se aparecer "Não foi possível
  // falar com o servidor", o site não chegou na API (o bug da porta 3000).
  assert.equal(await msg.getText(), 'E-mail ou senha incorretos.');
});
