import createRequire from 'module';
import fileUrlToPath from 'url';
import fs from 'fs';
import path from 'path';

global['Folder'] = {
  0: './src/',
  1: './scraper/',
  2: './src/set/',
  3: './tools/db/',
  4: './tools/db/user/',
  5: './connection/',
};
global['session'] = Folder[5] + 'session';