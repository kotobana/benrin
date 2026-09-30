import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importBooks} from '../src/importBooks.ts';
test('preserve unknown reading status, completion status, volumes, and duplicate source rows',()=>{const row=['本','著者','16','16','完結','⭐⭐⭐','感想','2026/09/01'];const books=importBooks({'漫画':{values:[row,row]}},'source');assert.equal(books.length,1);assert.equal(books[0].status,'unknown');assert.equal(books[0].sourceStatus,'完結');assert.equal(books[0].readVolumes,'16');assert.equal(books[0].rating,3);assert.deepEqual(books[0].sourceRows,[2,3]);assert.equal(books[0].finished,'');});
test('novel date, summary and review are kept separately',()=>{const [b]=importBooks({'小説':{values:[['本','著者','ミステリー','2026/09/15','紙の本','⭐⭐⭐⭐','概要','感想']]}},'source');assert.equal(b.status,'read');assert.equal(b.finished,'2026-09-15');assert.equal(b.summary,'概要');assert.equal(b.review,'感想');assert.equal(b.medium,'紙の本');});
