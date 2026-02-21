/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalizeEntryInput } = require('./validation.ts');

test('normalizeEntryInput validates required fields for journal', () => {
  const result = normalizeEntryInput('journal', {});
  assert.equal(result.data, undefined);
  assert.equal(result.error, 'Title and content are required');

  const onlyTitle = normalizeEntryInput('journal', { title: 'Test Title' });
  assert.equal(onlyTitle.data, undefined);
  assert.equal(onlyTitle.error, 'Title and content are required');

  const onlyContent = normalizeEntryInput('journal', { content: 'Test Content' });
  assert.equal(onlyContent.data, undefined);
  assert.equal(onlyContent.error, 'Title and content are required');
});

test('normalizeEntryInput accepts valid journal input', () => {
  const payload = {
    title: '  My Journal Entry  ',
    content: 'Interesting observations today.',
    outcome: 'Positive',
    emotion: 'Happy',
    tags: 'tag1,tag2',
    ticker: 'AAPL'
  };
  const { data, error } = normalizeEntryInput('journal', payload);

  assert.equal(error, undefined);
  assert.equal(data.title, 'My Journal Entry');
  assert.equal(data.content, 'Interesting observations today.');
  assert.equal(data.outcome, 'Positive');
  assert.equal(data.emotion, 'Happy');
  assert.deepEqual(data.tags, ['tag1', 'tag2']);
  assert.equal(data.ticker, 'AAPL');
});

test('normalizeEntryInput validates required fields for resources', () => {
  const result = normalizeEntryInput('resources', { title: 'T', content: 'C' });
  assert.equal(result.data, undefined);
  assert.equal(result.error, 'Title, content, and URL are required');
});

test('normalizeEntryInput validates URL for resources', () => {
  const noUrl = normalizeEntryInput('resources', { title: 'T', content: 'C', url: '' });
  assert.equal(noUrl.error, 'Title, content, and URL are required');

  const invalidUrl = normalizeEntryInput('resources', { title: 'T', content: 'C', url: 'not-a-url' });
  assert.equal(invalidUrl.error, 'URL must start with http:// or https://');

  const ftpUrl = normalizeEntryInput('resources', { title: 'T', content: 'C', url: 'ftp://files.com' });
  assert.equal(ftpUrl.error, 'URL must start with http:// or https://');
});

test('normalizeEntryInput accepts valid resources input', () => {
  const payload = {
    title: 'Resource Title',
    content: 'Resource Content',
    url: 'https://example.com',
    sourceType: 'Article',
    tags: ['tag1', 'tag2']
  };
  const { data, error } = normalizeEntryInput('resources', payload);

  assert.equal(error, undefined);
  assert.equal(data.title, 'Resource Title');
  assert.equal(data.url, 'https://example.com/');
  assert.equal(data.sourceType, 'Article');
  assert.deepEqual(data.tags, ['tag1', 'tag2']);
});

test('normalizeEntryInput accepts valid learning input', () => {
  const payload = {
    title: 'Learning Title',
    content: 'Learning Content',
    goal: 'Learn testing',
    nextStep: 'Write more tests'
  };
  const { data, error } = normalizeEntryInput('learning', payload);

  assert.equal(error, undefined);
  assert.equal(data.title, 'Learning Title');
  assert.equal(data.goal, 'Learn testing');
  assert.equal(data.nextStep, 'Write more tests');
});

test('normalizeEntryInput handles optional field normalization', () => {
  const payload = {
    title: 'Title',
    content: 'Content',
    outcome: '   ', // Should be undefined
    emotion: 'Very '.repeat(100), // Should be truncated
    ticker: 'invalid ticker!' // Should be undefined
  };
  const { data } = normalizeEntryInput('journal', payload);

  assert.equal(data.outcome, undefined);
  assert.equal(data.emotion.length, 200);
  assert.equal(data.ticker, undefined);
});

test('normalizeEntryInput handles tag normalization', () => {
  const { data } = normalizeEntryInput('journal', {
    title: 'T',
    content: 'C',
    tags: ' a, b , a,  ' // unique, trimmed, non-empty
  });
  assert.deepEqual(data.tags, ['a', 'b']);
});

test('normalizeEntryInput handles ticker normalization', () => {
  assert.equal(normalizeEntryInput('journal', { title: 'T', content: 'C', ticker: 'aapl' }).data.ticker, 'AAPL');
  assert.equal(normalizeEntryInput('journal', { title: 'T', content: 'C', ticker: 'BRK.B' }).data.ticker, 'BRK.B');
  assert.equal(normalizeEntryInput('journal', { title: 'T', content: 'C', ticker: 'longtickername' }).data.ticker, undefined);
});
