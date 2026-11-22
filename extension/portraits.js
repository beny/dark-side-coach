"use strict";

// Portraits on https://www.darksidemovement.cz/nas-tym, keyed by normalized full names.
const portraitBase = "https://cdn.prod.website-files.com/632d886d0602070140839dbf/";
const coachPortraits = new Map([
  ["adam cap", "680fc013eeb93fc2eddcf96f_f9dee6753bf821e6d2b9cc2f9539f63c_Adam%20Cap.webp"],
  ["adam hudec", "65947cb6d9baec1f854630ef_82b60b39016676e955148b43aa08e655_Frame%20173%20%281%29.webp"],
  ["anna holikova", "66dab07f97a6d5a22a4dd0e6_f309f0b80b20477bd950fa67cb52472c_Frame%20197.webp"],
  ["barbora fiedorova", "6a01b5e5e80a1b3ba6eab08f_Barca.webp"],
  ["ela lukasova", "69ea827b504dc33569e668d5_Ela.webp"],
  ["filip lukas", "680fb9c9409c052a27b209b3_cefd4bc81104b5c190b08f8d37c5d094_Filip%20Lukas.webp"],
  ["filip svoboda", "658f7b7de7844e205d54455d_901477c8e75b4ff006152ccc1faabb6e_Frame%20123.webp"],
  ["jakub flek", "6785100884df74ae13026d70_Kuba.webp"],
  ["jakub jerabek", "68714096f7d9aece82a43567_Hellion%202%20%281%29.webp"],
  ["jakub sznapka", "658f7b7de7844e205d544537_802e5f5c5a2230942b6e939495d6008b_Frame%20123.webp"],
  ["jaroslav vevoda", "680fc14c4081ef4fe2e0af91_b38b79d3a9a94c5cf9922fdf49ac6bb2_Jarek.webp"],
  ["kamil bednar", "69ea5ec0505dff410f33438a_Kamca.webp"],
  ["klara dvorackova", "67991eb49903a01b2c071e48_cce2df165cb57aa9459c2d6615353124_Klarka_no%20logo.webp"],
  ["milena marakova", "696501773934b9a4a7072836_Milca.webp"],
  ["miroslav janku", "69b126f6236144310a259ea6_Miro.webp"],
  ["natalia kurkova", "69f4801969bfebf897a6ce42_Natka.webp"],
  ["nikola jezkova", "66fa7cdfe7ab03a7d6a3febb_756eba9a99669445ce12f38225769cfc_Frame%20123.webp"],
  ["patrik budkovsky", "699e22529b262603abdfbed6_Burky.webp"],
  ["robin viktora", "63852cc3b3a7b850bc5ad0a7_Robko.webp"],
  ["sara stankova", "6afa251e1001f6ae276d0d98_Sara.webp"],
  ["tomas franta", "638531e10cae984180e2074d_Fero.webp"]
]);
