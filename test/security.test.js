import {test} from 'node:test';
import assert from 'node:assert/strict';
import {passwordHash,passwordMatches,validImage,validEmail} from '../lib/security.js';
test('salted passwords verify without accepting incorrect or malformed hashes',()=>{const encoded=passwordHash('a sample password');assert.ok(passwordMatches('a sample password',encoded));assert.ok(!passwordMatches('incorrect',encoded));assert.ok(!passwordMatches('x','malformed'));assert.notEqual(encoded,passwordHash('a sample password'));});
test('cover images cannot contain SVG or script schemes',()=>{assert.ok(validImage('data:image/png;base64,YWJj'));assert.ok(!validImage('data:image/svg+xml;base64,YWJj'));assert.ok(!validImage('javascript:alert(1)'));assert.ok(validEmail('someone@example.com'));assert.ok(!validEmail('invalid'));});
