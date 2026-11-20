// 자동 생성 — tools/catalog_plans_build.py (온라인 카탈로그 CAD 도면 PDF 를 판독해 옮긴 전시장 도면)
//   3D 는 도면 기반 자동 모델. 블렌더 실물 모델이 생기면 templates.js 의 실물 템플릿으로 교체
export const CATALOG_PLANS = [
 {
  "id": "cat-forest10-wg",
  "title": "FOREST10-WG 10평 체류형 쉼터",
  "category": "체류형 쉼터",
  "showroom": "김포 제1전시장",
  "tags": [
   "카탈로그도면",
   "FOREST10-WG",
   "10평 체류형 쉼터"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/forest10w/1783575974752_dt4l92.png?width=640&height=480&resize=cover&quality=70",
  "code": "FOREST10-WG",
  "catSlugs": [
   "forest10w01"
  ],
  "source": "catalog-cad",
  "confidence": "high",
  "base": {
   "name": "FOREST10-WG 10평 체류형 쉼터",
   "productType": "체류형 쉼터",
   "ceilingHeight": 2400,
   "foundationHeight": 300,
   "wallThickness": 280,
   "exterior": {
    "material": "metal",
    "color": "#f4f1ea",
    "dir": "v"
   },
   "roof": {
    "type": "gable",
    "color": "#3a3f44",
    "ridge": "x",
    "rise": 300
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "bed",
     "type": "bedroom",
     "name": "방",
     "x": 0,
     "y": 0,
     "w": 2410,
     "d": 3500
    },
    {
     "key": "kit",
     "type": "kitchen",
     "name": "주방/거실",
     "x": 2410,
     "y": 0,
     "w": 5850,
     "d": 2140,
     "open": [
      "s",
      "e"
     ]
    },
    {
     "key": "liv",
     "type": "living",
     "name": "거실",
     "x": 2410,
     "y": 2140,
     "w": 4510,
     "d": 1360,
     "open": [
      "n",
      "e"
     ]
    },
    {
     "key": "ent",
     "type": "entrance",
     "name": "현관",
     "x": 6920,
     "y": 2140,
     "w": 1340,
     "d": 1360,
     "open": [
      "n",
      "w",
      "e"
     ]
    },
    {
     "key": "wc",
     "type": "bath",
     "name": "화장실",
     "x": 8260,
     "y": 0,
     "w": 1740,
     "d": 1290
    },
    {
     "key": "wash",
     "type": "bath",
     "name": "세면대",
     "x": 8260,
     "y": 1290,
     "w": 1740,
     "d": 920,
     "open": [
      "w"
     ]
    },
    {
     "key": "shw",
     "type": "bath",
     "name": "샤워실",
     "x": 8260,
     "y": 2210,
     "w": 1740,
     "d": 1290
    }
   ],
   "openings": [
    {
     "roomKey": "bed",
     "side": "w",
     "pos": 2170,
     "winType": "fixed",
     "w": 1500,
     "h": 1000,
     "sill": 900
    },
    {
     "roomKey": "bed",
     "side": "s",
     "pos": 1300,
     "winType": "fixed",
     "w": 1000,
     "h": 800,
     "sill": 1100
    },
    {
     "roomKey": "bed",
     "side": "e",
     "pos": 730,
     "winType": "swingDoor",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "kit",
     "side": "n",
     "pos": 4290,
     "winType": "double",
     "w": 1400,
     "h": 600,
     "sill": 1100
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 1890,
     "winType": "balcony",
     "w": 2000,
     "h": 2100,
     "sill": 100
    },
    {
     "roomKey": "ent",
     "side": "s",
     "pos": 480,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "wc",
     "side": "n",
     "pos": 760,
     "winType": "double",
     "w": 600,
     "h": 500,
     "sill": 1600
    },
    {
     "roomKey": "wc",
     "side": "s",
     "pos": 450,
     "winType": "swingDoor",
     "w": 700,
     "h": 1900,
     "sill": 0
    },
    {
     "roomKey": "shw",
     "side": "n",
     "pos": 450,
     "winType": "swingDoor",
     "w": 700,
     "h": 1900,
     "sill": 0
    }
   ],
   "furniture": [
    {
     "catalogId": "sink",
     "x": 6410,
     "y": 580,
     "rotation": 0
    },
    {
     "catalogId": "fridge",
     "x": 7910,
     "y": 580,
     "rotation": 0
    },
    {
     "catalogId": "toilet",
     "x": 9370,
     "y": 720,
     "rotation": 90
    },
    {
     "catalogId": "basin",
     "x": 9530,
     "y": 1750,
     "rotation": 90
    }
   ]
  }
 },
 {
  "id": "cat-forest6-g",
  "title": "FOREST6-G 6평 쉼터",
  "category": "체류형 쉼터",
  "showroom": "안동전시장",
  "tags": [
   "카탈로그도면",
   "FOREST6-G",
   "6평 쉼터"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/forest6-or/1790841462826_sfo8iz.webp?width=640&height=480&resize=cover&quality=70",
  "code": "FOREST6-G",
  "catSlugs": [
   "cube6-wdg",
   "cube6-g"
  ],
  "source": "catalog-cad",
  "confidence": "high",
  "base": {
   "name": "FOREST6-G,B 6평 쉼터",
   "productType": "체류형 쉼터",
   "ceilingHeight": 2400,
   "foundationHeight": 150,
   "wallThickness": 200,
   "exterior": {
    "material": "metal",
    "color": "#8d96a0"
   },
   "roof": {
    "type": "gable",
    "color": "#3a3f44",
    "ridge": "x",
    "rise": 600
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "liv",
     "type": "living",
     "name": "거실",
     "x": 0,
     "y": 0,
     "w": 4760,
     "d": 3000
    },
    {
     "key": "bath",
     "type": "bath",
     "name": "욕실",
     "x": 4760,
     "y": 0,
     "w": 1740,
     "d": 3000
    }
   ],
   "openings": [
    {
     "roomKey": "liv",
     "side": "n",
     "pos": 2750,
     "winType": "double",
     "w": 1500,
     "h": 900,
     "sill": 1100
    },
    {
     "roomKey": "bath",
     "side": "n",
     "pos": 440,
     "winType": "double",
     "w": 600,
     "h": 500,
     "sill": 1600
    },
    {
     "roomKey": "liv",
     "side": "w",
     "pos": 1750,
     "winType": "double",
     "w": 900,
     "h": 600,
     "sill": 1100
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 2500,
     "winType": "balcony",
     "w": 2000,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 4250,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bath",
     "side": "w",
     "pos": 2450,
     "winType": "swingDoor",
     "w": 700,
     "h": 2000,
     "sill": 0
    }
   ],
   "furniture": [
    {
     "catalogId": "fridge",
     "x": 500,
     "y": 530,
     "rotation": 270
    },
    {
     "catalogId": "sink18",
     "x": 500,
     "y": 1840,
     "rotation": 270
    },
    {
     "catalogId": "toilet",
     "x": 5810,
     "y": 2410,
     "rotation": 90
    },
    {
     "catalogId": "basin",
     "x": 6080,
     "y": 1590,
     "rotation": 90
    }
   ]
  }
 },
 {
  "id": "cat-forest6-b",
  "title": "FOREST6-B 6평 쉼터",
  "category": "체류형 쉼터",
  "showroom": "김포 본사전시장",
  "tags": [
   "카탈로그도면",
   "FOREST6-B",
   "6평 쉼터"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/cube6-wdg/1790758455025_n6glql.webp?width=640&height=480&resize=cover&quality=70",
  "code": "FOREST6-B",
  "catSlugs": [
   "cube6-wdg",
   "cube6-g"
  ],
  "source": "catalog-cad",
  "confidence": "high",
  "base": {
   "name": "FOREST6-G,B 6평 쉼터",
   "productType": "체류형 쉼터",
   "ceilingHeight": 2400,
   "foundationHeight": 150,
   "wallThickness": 200,
   "exterior": {
    "material": "metal",
    "color": "#8d96a0"
   },
   "roof": {
    "type": "gable",
    "color": "#3a3f44",
    "ridge": "x",
    "rise": 600
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "liv",
     "type": "living",
     "name": "거실",
     "x": 0,
     "y": 0,
     "w": 4760,
     "d": 3000
    },
    {
     "key": "bath",
     "type": "bath",
     "name": "욕실",
     "x": 4760,
     "y": 0,
     "w": 1740,
     "d": 3000
    }
   ],
   "openings": [
    {
     "roomKey": "liv",
     "side": "n",
     "pos": 2750,
     "winType": "double",
     "w": 1500,
     "h": 900,
     "sill": 1100
    },
    {
     "roomKey": "bath",
     "side": "n",
     "pos": 440,
     "winType": "double",
     "w": 600,
     "h": 500,
     "sill": 1600
    },
    {
     "roomKey": "liv",
     "side": "w",
     "pos": 1750,
     "winType": "double",
     "w": 900,
     "h": 600,
     "sill": 1100
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 2500,
     "winType": "balcony",
     "w": 2000,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 4250,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bath",
     "side": "w",
     "pos": 2450,
     "winType": "swingDoor",
     "w": 700,
     "h": 2000,
     "sill": 0
    }
   ],
   "furniture": [
    {
     "catalogId": "fridge",
     "x": 500,
     "y": 530,
     "rotation": 270
    },
    {
     "catalogId": "sink18",
     "x": 500,
     "y": 1840,
     "rotation": 270
    },
    {
     "catalogId": "toilet",
     "x": 5810,
     "y": 2410,
     "rotation": 90
    },
    {
     "catalogId": "basin",
     "x": 6080,
     "y": 1590,
     "rotation": 90
    }
   ]
  }
 },
 {
  "id": "cat-stay10-6-w",
  "title": "STAY10-6-W 16평 전원주택 (본사)",
  "category": "주택",
  "showroom": "김포 본사전시장",
  "tags": [
   "카탈로그도면",
   "STAY10-6-W",
   "16평 전원주택"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/stay10-wx2/1790757660749_iq487f.webp?width=640&height=480&resize=cover&quality=70",
  "code": "STAY10-6-W",
  "catSlugs": [
   "stay10-wx2"
  ],
  "codeNote": "본사",
  "source": "catalog-cad",
  "confidence": "medium",
  "base": {
   "name": "STAY10-6-W 16평 전원주택 (본사)",
   "productType": "주택",
   "ceilingHeight": 2400,
   "foundationHeight": 200,
   "wallThickness": 280,
   "exterior": {
    "material": "metal",
    "color": "#f4f1ea",
    "dir": "v"
   },
   "roof": {
    "type": "flat",
    "color": "#3a3f44"
   },
   "wallThicknessInt": 120,
   "floors": [
    {
     "rooms": [
      {
       "key": "liv",
       "type": "living",
       "name": "거실",
       "x": 0,
       "y": 0,
       "w": 4000,
       "d": 3500,
       "open": [
        "e"
       ]
      },
      {
       "key": "kit",
       "type": "kitchen",
       "name": "주방",
       "x": 4000,
       "y": 0,
       "w": 4760,
       "d": 3500,
       "open": [
        "w"
       ]
      },
      {
       "key": "bath",
       "type": "bath",
       "name": "욕실",
       "x": 8760,
       "y": 0,
       "w": 1740,
       "d": 3500
      }
     ],
     "openings": [
      {
       "roomKey": "liv",
       "side": "n",
       "pos": 2650,
       "winType": "fixed",
       "w": 1500,
       "h": 800,
       "sill": 1100
      },
      {
       "roomKey": "kit",
       "side": "n",
       "pos": 3050,
       "winType": "double",
       "w": 1500,
       "h": 800,
       "sill": 1100
      },
      {
       "roomKey": "liv",
       "side": "s",
       "pos": 3000,
       "winType": "balcony",
       "w": 2000,
       "h": 2100,
       "sill": 0
      },
      {
       "roomKey": "bath",
       "side": "s",
       "pos": 740,
       "winType": "double",
       "w": 600,
       "h": 500,
       "sill": 1250
      },
      {
       "roomKey": "liv",
       "side": "w",
       "pos": 1150,
       "winType": "fixed",
       "w": 700,
       "h": 1800,
       "sill": 250
      },
      {
       "roomKey": "liv",
       "side": "w",
       "pos": 2250,
       "winType": "door",
       "w": 900,
       "h": 2100,
       "sill": 0
      },
      {
       "roomKey": "bath",
       "side": "w",
       "pos": 1820,
       "winType": "pocketDoor",
       "w": 700,
       "h": 1800,
       "sill": 0
      }
     ],
     "furniture": [
      {
       "catalogId": "fridge",
       "x": 5620,
       "y": 590,
       "rotation": 0
      },
      {
       "catalogId": "sink18",
       "x": 7200,
       "y": 600,
       "rotation": 0
      },
      {
       "catalogId": "washer",
       "x": 8400,
       "y": 600,
       "rotation": 0
      },
      {
       "catalogId": "stairs",
       "x": 7720,
       "y": 2910,
       "rotation": 180
      },
      {
       "catalogId": "basin",
       "x": 10090,
       "y": 1790,
       "rotation": 90
      },
      {
       "catalogId": "toilet",
       "x": 9820,
       "y": 2770,
       "rotation": 90
      }
     ],
     "name": "1층"
    },
    {
     "rooms": [
      {
       "key": "ter",
       "type": "deck",
       "name": "테라스",
       "x": 0,
       "y": 0,
       "w": 4000,
       "d": 3500,
       "rail": [
        "n",
        "s",
        "w"
       ]
      },
      {
       "key": "attic",
       "type": "attic",
       "name": "다락",
       "x": 4000,
       "y": 0,
       "w": 6500,
       "d": 3500
      }
     ],
     "openings": [
      {
       "roomKey": "attic",
       "side": "n",
       "pos": 3050,
       "winType": "double",
       "w": 1500,
       "h": 650,
       "sill": 100
      },
      {
       "roomKey": "attic",
       "side": "w",
       "pos": 1750,
       "winType": "double",
       "w": 1500,
       "h": 650,
       "sill": 100
      },
      {
       "roomKey": "attic",
       "side": "e",
       "pos": 1750,
       "winType": "fixed",
       "w": 1800,
       "h": 650,
       "sill": 100
      },
      {
       "roomKey": "attic",
       "side": "s",
       "pos": 5500,
       "winType": "fixed",
       "w": 600,
       "h": 600,
       "sill": 100
      }
     ],
     "furniture": [],
     "name": "다락"
    }
   ]
  }
 },
 {
  "id": "cat-forest10-g",
  "title": "FOREST10-G 10평 쉼터",
  "category": "체류형 쉼터",
  "showroom": "김포 제1전시장",
  "tags": [
   "카탈로그도면",
   "FOREST10-G",
   "10평 쉼터"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/model-mup2nwhx-137/1790831822349_9vb7gj.webp?width=640&height=480&resize=cover&quality=70",
  "code": "FOREST10-G",
  "catSlugs": [
   "cube-g-10w",
   "forest10-w",
   "forest6-or",
   "model-mup2nwhx-137"
  ],
  "source": "catalog-cad",
  "confidence": "medium",
  "base": {
   "name": "FOREST10-GW 10평 쉼터",
   "productType": "체류형 쉼터",
   "ceilingHeight": 2400,
   "foundationHeight": 150,
   "wallThickness": 200,
   "exterior": {
    "material": "metal",
    "color": "#8d96a0",
    "corner": "#b8773e"
   },
   "roof": {
    "type": "flat",
    "color": "#f4f1ea"
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "util",
     "type": "utility",
     "name": "다용도실",
     "x": 0,
     "y": 0,
     "w": 1160,
     "d": 1460
    },
    {
     "key": "ent",
     "type": "entrance",
     "name": "현관",
     "x": 0,
     "y": 1460,
     "w": 1160,
     "d": 1740
    },
    {
     "key": "ldk",
     "type": "living",
     "name": "거실/주방",
     "x": 1160,
     "y": 0,
     "w": 2920,
     "d": 3200,
     "open": [
      "e"
     ]
    },
    {
     "key": "dress",
     "type": "dress",
     "name": "드레스룸",
     "x": 4080,
     "y": 0,
     "w": 1320,
     "d": 2040,
     "open": [
      "s"
     ]
    },
    {
     "key": "bed",
     "type": "bedroom",
     "name": "침실",
     "x": 5400,
     "y": 0,
     "w": 2340,
     "d": 2040,
     "open": [
      "s"
     ]
    },
    {
     "key": "hall",
     "type": "hall",
     "name": "복도",
     "x": 4080,
     "y": 2040,
     "w": 3660,
     "d": 1160,
     "open": [
      "n",
      "w"
     ]
    },
    {
     "key": "bath",
     "type": "bath",
     "name": "욕실",
     "x": 7740,
     "y": 0,
     "w": 1460,
     "d": 3200
    },
    {
     "key": "porchW",
     "type": "porch",
     "name": "포치",
     "x": -900,
     "y": 0,
     "w": 900,
     "d": 3200
    },
    {
     "key": "porchE",
     "type": "porch",
     "name": "포치",
     "x": 9200,
     "y": 0,
     "w": 900,
     "d": 3200
    }
   ],
   "openings": [
    {
     "roomKey": "ent",
     "side": "w",
     "pos": 690,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "ent",
     "side": "e",
     "pos": 890,
     "winType": "glassSlide",
     "w": 1200,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "util",
     "side": "s",
     "pos": 750,
     "winType": "swingDoor",
     "w": 700,
     "h": 2000,
     "sill": 0
    },
    {
     "roomKey": "ldk",
     "side": "n",
     "pos": 1440,
     "winType": "double",
     "w": 1200,
     "h": 1000,
     "sill": 1100
    },
    {
     "roomKey": "ldk",
     "side": "s",
     "pos": 1140,
     "winType": "fixed",
     "w": 600,
     "h": 1500,
     "sill": 900
    },
    {
     "roomKey": "ldk",
     "side": "s",
     "pos": 2340,
     "winType": "fixed",
     "w": 600,
     "h": 1500,
     "sill": 900
    },
    {
     "roomKey": "bed",
     "side": "n",
     "pos": 1250,
     "winType": "double",
     "w": 1500,
     "h": 1000,
     "sill": 900
    },
    {
     "roomKey": "hall",
     "side": "s",
     "pos": 2320,
     "winType": "fixed",
     "w": 2000,
     "h": 1500,
     "sill": 900
    },
    {
     "roomKey": "bath",
     "side": "n",
     "pos": 660,
     "winType": "casement",
     "w": 600,
     "h": 1500,
     "sill": 900
    },
    {
     "roomKey": "bath",
     "side": "e",
     "pos": 2450,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bath",
     "side": "w",
     "pos": 2590,
     "winType": "pocketDoor",
     "w": 800,
     "h": 2000,
     "sill": 0
    }
   ],
   "furniture": [
    {
     "catalogId": "toilet",
     "x": 8510,
     "y": 660,
     "rotation": 90
    },
    {
     "catalogId": "basin",
     "x": 8620,
     "y": 1410,
     "rotation": 90
    },
    {
     "catalogId": "fridge",
     "x": 3690,
     "y": 1600,
     "rotation": 90
    },
    {
     "catalogId": "washer",
     "x": 640,
     "y": 510,
     "rotation": 0
    }
   ]
  }
 },
 {
  "id": "cat-forest10-w",
  "title": "FOREST10-W 10평 쉼터",
  "category": "체류형 쉼터",
  "showroom": "김포 본사전시장",
  "tags": [
   "카탈로그도면",
   "FOREST10-W",
   "10평 쉼터"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/forest10-w/1790757184845_vdehi1.webp?width=640&height=480&resize=cover&quality=70",
  "code": "FOREST10-W",
  "catSlugs": [
   "cube-g-10w",
   "forest10-w",
   "forest6-or",
   "model-mup2nwhx-137"
  ],
  "source": "catalog-cad",
  "confidence": "medium",
  "base": {
   "name": "FOREST10-GW 10평 쉼터",
   "productType": "체류형 쉼터",
   "ceilingHeight": 2400,
   "foundationHeight": 150,
   "wallThickness": 200,
   "exterior": {
    "material": "metal",
    "color": "#8d96a0",
    "corner": "#b8773e"
   },
   "roof": {
    "type": "flat",
    "color": "#f4f1ea"
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "util",
     "type": "utility",
     "name": "다용도실",
     "x": 0,
     "y": 0,
     "w": 1160,
     "d": 1460
    },
    {
     "key": "ent",
     "type": "entrance",
     "name": "현관",
     "x": 0,
     "y": 1460,
     "w": 1160,
     "d": 1740
    },
    {
     "key": "ldk",
     "type": "living",
     "name": "거실/주방",
     "x": 1160,
     "y": 0,
     "w": 2920,
     "d": 3200,
     "open": [
      "e"
     ]
    },
    {
     "key": "dress",
     "type": "dress",
     "name": "드레스룸",
     "x": 4080,
     "y": 0,
     "w": 1320,
     "d": 2040,
     "open": [
      "s"
     ]
    },
    {
     "key": "bed",
     "type": "bedroom",
     "name": "침실",
     "x": 5400,
     "y": 0,
     "w": 2340,
     "d": 2040,
     "open": [
      "s"
     ]
    },
    {
     "key": "hall",
     "type": "hall",
     "name": "복도",
     "x": 4080,
     "y": 2040,
     "w": 3660,
     "d": 1160,
     "open": [
      "n",
      "w"
     ]
    },
    {
     "key": "bath",
     "type": "bath",
     "name": "욕실",
     "x": 7740,
     "y": 0,
     "w": 1460,
     "d": 3200
    },
    {
     "key": "porchW",
     "type": "porch",
     "name": "포치",
     "x": -900,
     "y": 0,
     "w": 900,
     "d": 3200
    },
    {
     "key": "porchE",
     "type": "porch",
     "name": "포치",
     "x": 9200,
     "y": 0,
     "w": 900,
     "d": 3200
    }
   ],
   "openings": [
    {
     "roomKey": "ent",
     "side": "w",
     "pos": 690,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "ent",
     "side": "e",
     "pos": 890,
     "winType": "glassSlide",
     "w": 1200,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "util",
     "side": "s",
     "pos": 750,
     "winType": "swingDoor",
     "w": 700,
     "h": 2000,
     "sill": 0
    },
    {
     "roomKey": "ldk",
     "side": "n",
     "pos": 1440,
     "winType": "double",
     "w": 1200,
     "h": 1000,
     "sill": 1100
    },
    {
     "roomKey": "ldk",
     "side": "s",
     "pos": 1140,
     "winType": "fixed",
     "w": 600,
     "h": 1500,
     "sill": 900
    },
    {
     "roomKey": "ldk",
     "side": "s",
     "pos": 2340,
     "winType": "fixed",
     "w": 600,
     "h": 1500,
     "sill": 900
    },
    {
     "roomKey": "bed",
     "side": "n",
     "pos": 1250,
     "winType": "double",
     "w": 1500,
     "h": 1000,
     "sill": 900
    },
    {
     "roomKey": "hall",
     "side": "s",
     "pos": 2320,
     "winType": "fixed",
     "w": 2000,
     "h": 1500,
     "sill": 900
    },
    {
     "roomKey": "bath",
     "side": "n",
     "pos": 660,
     "winType": "casement",
     "w": 600,
     "h": 1500,
     "sill": 900
    },
    {
     "roomKey": "bath",
     "side": "e",
     "pos": 2450,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bath",
     "side": "w",
     "pos": 2590,
     "winType": "pocketDoor",
     "w": 800,
     "h": 2000,
     "sill": 0
    }
   ],
   "furniture": [
    {
     "catalogId": "toilet",
     "x": 8510,
     "y": 660,
     "rotation": 90
    },
    {
     "catalogId": "basin",
     "x": 8620,
     "y": 1410,
     "rotation": 90
    },
    {
     "catalogId": "fridge",
     "x": 3690,
     "y": 1600,
     "rotation": 90
    },
    {
     "catalogId": "washer",
     "x": 640,
     "y": 510,
     "rotation": 0
    }
   ]
  }
 },
 {
  "id": "cat-forest6-m",
  "title": "FOREST6-M 6평 체류형 쉼터",
  "category": "체류형 쉼터",
  "showroom": "김포 본사전시장",
  "tags": [
   "카탈로그도면",
   "FOREST6-M",
   "6평 체류형 쉼터"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/cube6-p/1790758738383_64vldg.webp?width=640&height=480&resize=cover&quality=70",
  "code": "FOREST6-M",
  "catSlugs": [
   "cube6-p"
  ],
  "source": "catalog-cad",
  "confidence": "high",
  "base": {
   "name": "FOREST6-M 6평 체류형 쉼터",
   "productType": "체류형 쉼터",
   "ceilingHeight": 2300,
   "foundationHeight": 150,
   "wallThickness": 200,
   "exterior": {
    "material": "metal",
    "color": "#8d96a0",
    "dir": "v"
   },
   "roof": {
    "type": "flat",
    "color": "#3a3f44"
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "bath",
     "type": "bath",
     "name": "화장실",
     "x": 0,
     "y": 0,
     "w": 1760,
     "d": 1460
    },
    {
     "key": "kit",
     "type": "kitchen",
     "name": "주방",
     "x": 0,
     "y": 1460,
     "w": 1760,
     "d": 1540,
     "open": [
      "e"
     ]
    },
    {
     "key": "liv",
     "type": "living",
     "name": "거실",
     "x": 1760,
     "y": 0,
     "w": 4240,
     "d": 3000,
     "open": [
      "w"
     ]
    },
    {
     "key": "deck",
     "type": "deck",
     "name": "데크",
     "x": 6000,
     "y": 0,
     "w": 900,
     "d": 3000
    }
   ],
   "openings": [
    {
     "roomKey": "liv",
     "side": "n",
     "pos": 1240,
     "winType": "casement",
     "w": 800,
     "h": 1800,
     "sill": 300
    },
    {
     "roomKey": "liv",
     "side": "n",
     "pos": 3040,
     "winType": "casement",
     "w": 800,
     "h": 1800,
     "sill": 300
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 2040,
     "winType": "casement2",
     "w": 2000,
     "h": 1200,
     "sill": 700
    },
    {
     "roomKey": "liv",
     "side": "e",
     "pos": 1500,
     "winType": "foldSwing",
     "w": 2600,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bath",
     "side": "w",
     "pos": 800,
     "winType": "casement",
     "w": 600,
     "h": 500,
     "sill": 1300
    },
    {
     "roomKey": "bath",
     "side": "s",
     "pos": 1290,
     "winType": "swingDoor",
     "w": 700,
     "h": 1900,
     "sill": 0
    }
   ],
   "furniture": [
    {
     "catalogId": "toilet",
     "x": 610,
     "y": 700,
     "rotation": 0
    },
    {
     "catalogId": "basin",
     "x": 1310,
     "y": 400,
     "rotation": 0
    },
    {
     "catalogId": "induction2",
     "x": 440,
     "y": 2500,
     "rotation": 180
    }
   ]
  }
 },
 {
  "id": "cat-forest10-bw",
  "title": "FOREST10-BW 10평 쉼터",
  "category": "체류형 쉼터",
  "showroom": "김포 본사전시장",
  "tags": [
   "카탈로그도면",
   "FOREST10-BW",
   "10평 쉼터"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/forest10-wdw/1790755917456_wkhth4.webp?width=640&height=480&resize=cover&quality=70",
  "code": "FOREST10-BW",
  "catSlugs": [
   "forest10-wdw"
  ],
  "source": "catalog-cad",
  "confidence": "high",
  "base": {
   "name": "FOREST10-BW 10평 쉼터",
   "productType": "체류형 쉼터",
   "ceilingHeight": 2400,
   "foundationHeight": 150,
   "wallThickness": 200,
   "exterior": {
    "material": "metalV",
    "color": "#b8773e",
    "dir": "v"
   },
   "roof": {
    "type": "gable",
    "color": "#3a3f44",
    "ridge": "x",
    "rise": 600
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "bath",
     "type": "bath",
     "name": "욕실",
     "x": 0,
     "y": 0,
     "w": 1760,
     "d": 3000
    },
    {
     "key": "kit",
     "type": "kitchen",
     "name": "주방",
     "x": 1760,
     "y": 0,
     "w": 4100,
     "d": 3000,
     "open": [
      "s"
     ]
    },
    {
     "key": "bed",
     "type": "bedroom",
     "name": "방",
     "x": 5860,
     "y": 0,
     "w": 2340,
     "d": 3000
    },
    {
     "key": "liv",
     "type": "living",
     "name": "거실",
     "x": 1800,
     "y": 3000,
     "w": 4200,
     "d": 2600,
     "open": [
      "n"
     ]
    },
    {
     "key": "deckW",
     "type": "deck",
     "name": "데크",
     "x": 0,
     "y": 3000,
     "w": 1800,
     "d": 2600
    },
    {
     "key": "deckE",
     "type": "deck",
     "name": "데크",
     "x": 6000,
     "y": 3000,
     "w": 2200,
     "d": 2600,
     "rail": [
      "e"
     ]
    }
   ],
   "openings": [
    {
     "roomKey": "bath",
     "side": "n",
     "pos": 1200,
     "winType": "double",
     "w": 600,
     "h": 500,
     "sill": 1600
    },
    {
     "roomKey": "bath",
     "side": "e",
     "pos": 2390,
     "winType": "swingDoor",
     "w": 700,
     "h": 2000,
     "sill": 0
    },
    {
     "roomKey": "kit",
     "side": "n",
     "pos": 2790,
     "winType": "double",
     "w": 1500,
     "h": 900,
     "sill": 1200
    },
    {
     "roomKey": "bed",
     "side": "n",
     "pos": 1090,
     "winType": "fixed",
     "w": 1000,
     "h": 900,
     "sill": 1200
    },
    {
     "roomKey": "bed",
     "side": "e",
     "pos": 1500,
     "winType": "double",
     "w": 1500,
     "h": 900,
     "sill": 1200
    },
    {
     "roomKey": "bed",
     "side": "w",
     "pos": 2330,
     "winType": "swingDoor",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 2250,
     "winType": "balcony",
     "w": 2500,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "liv",
     "side": "w",
     "pos": 1550,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "liv",
     "side": "e",
     "pos": 550,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    }
   ],
   "furniture": [
    {
     "catalogId": "toilet",
     "x": 600,
     "y": 2430,
     "rotation": 270
    },
    {
     "catalogId": "basin",
     "x": 410,
     "y": 1700,
     "rotation": 270
    },
    {
     "catalogId": "fridge",
     "x": 2170,
     "y": 560,
     "rotation": 0
    },
    {
     "catalogId": "sink",
     "x": 4600,
     "y": 575,
     "rotation": 0
    },
    {
     "catalogId": "bedS",
     "x": 6950,
     "y": 750,
     "rotation": 270
    }
   ]
  }
 },
 {
  "id": "cat-forest6-o",
  "title": "FOREST6-O 6평 쉼터",
  "category": "체류형 쉼터",
  "showroom": "안동전시장",
  "tags": [
   "카탈로그도면",
   "FOREST6-O",
   "6평 쉼터"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/forest6-o/1790837341872_17h57y.webp?width=640&height=480&resize=cover&quality=70",
  "code": "FOREST6-O",
  "catSlugs": [
   "forest6-o"
  ],
  "source": "catalog-cad",
  "confidence": "high",
  "base": {
   "name": "FOREST6-O 6평 쉼터",
   "productType": "체류형 쉼터",
   "ceilingHeight": 2300,
   "foundationHeight": 150,
   "wallThickness": 200,
   "exterior": {
    "material": "metal",
    "color": "#444b54",
    "dir": "v"
   },
   "roof": {
    "type": "flat",
    "color": "#3a3f44"
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "liv",
     "type": "living",
     "name": "거실",
     "x": 0,
     "y": 0,
     "w": 3640,
     "d": 3000
    },
    {
     "key": "bath",
     "type": "bath",
     "name": "화장실",
     "x": 3640,
     "y": 0,
     "w": 2360,
     "d": 1460
    },
    {
     "key": "kit",
     "type": "kitchen",
     "name": "주방",
     "x": 3640,
     "y": 1460,
     "w": 2360,
     "d": 1540,
     "open": [
      "w"
     ]
    }
   ],
   "openings": [
    {
     "roomKey": "liv",
     "side": "n",
     "pos": 1490,
     "winType": "double",
     "w": 1500,
     "h": 700,
     "sill": 1200
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 1740,
     "winType": "balcony",
     "w": 2000,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "kit",
     "side": "s",
     "pos": 450,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "kit",
     "side": "e",
     "pos": 725,
     "winType": "double",
     "w": 1000,
     "h": 600,
     "sill": 1100
    },
    {
     "roomKey": "bath",
     "side": "e",
     "pos": 800,
     "winType": "double",
     "w": 600,
     "h": 500,
     "sill": 1500
    },
    {
     "roomKey": "bath",
     "side": "s",
     "pos": 460,
     "winType": "swingDoor",
     "w": 700,
     "h": 1900,
     "sill": 0
    }
   ],
   "furniture": [
    {
     "catalogId": "basin",
     "x": 4080,
     "y": 420,
     "rotation": 0
    },
    {
     "catalogId": "toilet",
     "x": 4760,
     "y": 760,
     "rotation": 0
    }
   ]
  }
 },
 {
  "id": "cat-forest10-e",
  "title": "FOREST10-E 10평 체류형쉼터",
  "category": "체류형 쉼터",
  "showroom": "김포 제1전시장",
  "tags": [
   "카탈로그도면",
   "FOREST10-E",
   "10평 체류형쉼터"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/forest10-e/1790831077921_7xr850.webp?width=640&height=480&resize=cover&quality=70",
  "code": "FOREST10-E",
  "catSlugs": [
   "forest13"
  ],
  "source": "catalog-cad",
  "confidence": "high",
  "base": {
   "name": "FOREST10-E 10평 체류형쉼터",
   "productType": "체류형 쉼터",
   "ceilingHeight": 2400,
   "foundationHeight": 300,
   "wallThickness": 280,
   "exterior": {
    "material": "wood",
    "color": "#9c7244",
    "dir": "v"
   },
   "roof": {
    "type": "flat",
    "color": "#3a3f44"
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "bed",
     "type": "bedroom",
     "name": "방",
     "x": 0,
     "y": 0,
     "w": 2590,
     "d": 3280
    },
    {
     "key": "bath",
     "type": "bath",
     "name": "욕실",
     "x": 2590,
     "y": 0,
     "w": 2280,
     "d": 1740
    },
    {
     "key": "hall",
     "type": "hall",
     "name": "복도",
     "x": 2590,
     "y": 1740,
     "w": 2280,
     "d": 1540,
     "open": [
      "e"
     ]
    },
    {
     "key": "kit",
     "type": "kitchen",
     "name": "주방",
     "x": 4870,
     "y": 0,
     "w": 3110,
     "d": 3280,
     "open": [
      "w",
      "s"
     ]
    },
    {
     "key": "liv",
     "type": "living",
     "name": "거실",
     "x": 4400,
     "y": 3280,
     "w": 3580,
     "d": 3000,
     "open": [
      "n"
     ]
    },
    {
     "key": "deck",
     "type": "deck",
     "name": "데크",
     "x": 0,
     "y": 3280,
     "w": 4400,
     "d": 3000,
     "rail": [
      "w",
      "s"
     ]
    }
   ],
   "openings": [
    {
     "roomKey": "bed",
     "side": "w",
     "pos": 1950,
     "winType": "double",
     "w": 1400,
     "h": 1000,
     "sill": 1000
    },
    {
     "roomKey": "bed",
     "side": "s",
     "pos": 1405,
     "winType": "fixed",
     "w": 1200,
     "h": 900,
     "sill": 1100
    },
    {
     "roomKey": "bed",
     "side": "e",
     "pos": 2550,
     "winType": "pocketDoor",
     "w": 800,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bath",
     "side": "s",
     "pos": 445,
     "winType": "swingDoor",
     "w": 700,
     "h": 2000,
     "sill": 0
    },
    {
     "roomKey": "hall",
     "side": "s",
     "pos": 935,
     "winType": "fixed",
     "w": 700,
     "h": 1800,
     "sill": 300
    },
    {
     "roomKey": "kit",
     "side": "n",
     "pos": 1880,
     "winType": "double",
     "w": 1000,
     "h": 600,
     "sill": 1100
    },
    {
     "roomKey": "liv",
     "side": "w",
     "pos": 1370,
     "winType": "folding",
     "w": 2500,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 1790,
     "winType": "balcony",
     "w": 2000,
     "h": 2100,
     "sill": 50
    }
   ],
   "furniture": [
    {
     "catalogId": "toilet",
     "x": 2960,
     "y": 660,
     "rotation": 0
    },
    {
     "catalogId": "basin",
     "x": 3660,
     "y": 450,
     "rotation": 0
    },
    {
     "catalogId": "fridge",
     "x": 5280,
     "y": 610,
     "rotation": 0
    },
    {
     "catalogId": "induction",
     "x": 6040,
     "y": 590,
     "rotation": 0
    }
   ]
  }
 },
 {
  "id": "cat-cube-h4-bk",
  "title": "CUBE-H4-BK 4평 황토방",
  "category": "특별모델",
  "showroom": "안동전시장",
  "tags": [
   "카탈로그도면",
   "CUBE-H4-BK",
   "4평 황토방"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/cube-h4-bk/1791872045731_gdyk2v.webp?width=640&height=480&resize=cover&quality=70",
  "code": "CUBE-H4-BK",
  "catSlugs": [
   "cube-h4-bk"
  ],
  "source": "catalog-cad",
  "confidence": "medium",
  "base": {
   "name": "CUBE-H4-BK 4평 황토방",
   "productType": "농막",
   "ceilingHeight": 2400,
   "foundationHeight": 200,
   "wallThickness": 200,
   "exterior": {
    "material": "ceramic",
    "color": "#c08f5a",
    "corner": "#2f3237"
   },
   "roof": {
    "type": "shed",
    "color": "#3a3f44",
    "rise": 300
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "room",
     "type": "room",
     "name": "황토방",
     "x": 0,
     "y": 0,
     "w": 3200,
     "d": 4200
    },
    {
     "key": "porch",
     "type": "porch",
     "name": "포치",
     "x": 0,
     "y": 4200,
     "w": 3200,
     "d": 1800,
     "rail": [
      "e",
      "w"
     ]
    }
   ],
   "openings": [
    {
     "roomKey": "room",
     "side": "w",
     "pos": 2100,
     "winType": "double",
     "w": 1400,
     "h": 800,
     "sill": 1150
    },
    {
     "roomKey": "room",
     "side": "e",
     "pos": 2100,
     "winType": "double",
     "w": 1400,
     "h": 800,
     "sill": 1150
    },
    {
     "roomKey": "room",
     "side": "s",
     "pos": 1600,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    }
   ],
   "furniture": []
  }
 },
 {
  "id": "cat-stay12-6-w",
  "title": "STAY12-6-W 18평 전원주택",
  "category": "주택",
  "showroom": "김포 제1전시장",
  "tags": [
   "카탈로그도면",
   "STAY12-6-W",
   "18평 전원주택"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/stay18w/1782109852710_soq3iq.png?width=640&height=480&resize=cover&quality=70",
  "code": "STAY12-6-W",
  "catSlugs": [
   "stay18w"
  ],
  "source": "catalog-cad",
  "confidence": "medium",
  "base": {
   "name": "STAY12-6-W 18평 전원주택",
   "productType": "주택",
   "ceilingHeight": 2400,
   "foundationHeight": 150,
   "wallThickness": 280,
   "exterior": {
    "material": "metal",
    "color": "#f4f1ea",
    "dir": "v"
   },
   "roof": {
    "type": "gable",
    "color": "#3a3f44",
    "ridge": "x",
    "rise": 500
   },
   "wallThicknessInt": 120,
   "floors": [
    {
     "rooms": [
      {
       "key": "bath",
       "type": "bath",
       "name": "화장실",
       "x": 0,
       "y": 0,
       "w": 1740,
       "d": 2340
      },
      {
       "key": "util",
       "type": "utility",
       "name": "다용도실",
       "x": 0,
       "y": 2340,
       "w": 1740,
       "d": 1660,
       "open": [
        "e"
       ]
      },
      {
       "key": "kit",
       "type": "kitchen",
       "name": "주방/식당",
       "x": 1740,
       "y": 0,
       "w": 3960,
       "d": 4000,
       "open": [
        "e"
       ]
      },
      {
       "key": "liv",
       "type": "living",
       "name": "거실",
       "x": 5700,
       "y": 0,
       "w": 5000,
       "d": 4000,
       "open": [
        "w"
       ]
      },
      {
       "key": "porch",
       "type": "porch",
       "name": "포치",
       "x": 10700,
       "y": 0,
       "w": 900,
       "d": 4000
      },
      {
       "key": "deckS",
       "type": "deck",
       "name": "데크",
       "x": 0,
       "y": 4000,
       "w": 11600,
       "d": 1500
      },
      {
       "key": "deckE",
       "type": "deck",
       "name": "데크",
       "x": 11600,
       "y": 0,
       "w": 600,
       "d": 5500
      }
     ],
     "openings": [
      {
       "roomKey": "bath",
       "side": "n",
       "pos": 980,
       "winType": "double",
       "w": 600,
       "h": 500,
       "sill": 1250
      },
      {
       "roomKey": "bath",
       "side": "s",
       "pos": 1280,
       "winType": "swingDoor",
       "w": 700,
       "h": 2000,
       "sill": 0
      },
      {
       "roomKey": "kit",
       "side": "s",
       "pos": 2360,
       "winType": "double",
       "w": 2000,
       "h": 900,
       "sill": 900
      },
      {
       "roomKey": "liv",
       "side": "n",
       "pos": 1660,
       "winType": "fixed",
       "w": 600,
       "h": 1800,
       "sill": 50
      },
      {
       "roomKey": "liv",
       "side": "n",
       "pos": 3060,
       "winType": "fixed",
       "w": 600,
       "h": 1800,
       "sill": 50
      },
      {
       "roomKey": "liv",
       "side": "s",
       "pos": 2360,
       "winType": "fixed",
       "w": 2000,
       "h": 700,
       "sill": 1000
      },
      {
       "roomKey": "liv",
       "side": "e",
       "pos": 1370,
       "winType": "balcony",
       "w": 1600,
       "h": 2100,
       "sill": 0
      },
      {
       "roomKey": "liv",
       "side": "e",
       "pos": 2920,
       "winType": "door",
       "w": 900,
       "h": 2100,
       "sill": 0
      }
     ],
     "furniture": [
      {
       "catalogId": "toilet",
       "x": 660,
       "y": 1830,
       "rotation": 270
      },
      {
       "catalogId": "basin",
       "x": 450,
       "y": 1320,
       "rotation": 270
      },
      {
       "catalogId": "washer",
       "x": 570,
       "y": 2680,
       "rotation": 270
      },
      {
       "catalogId": "fridge",
       "x": 2660,
       "y": 640,
       "rotation": 0
      },
      {
       "catalogId": "sink18",
       "x": 2080,
       "y": 2060,
       "rotation": 270
      },
      {
       "catalogId": "stairs",
       "x": 4680,
       "y": 650,
       "rotation": 0
      }
     ],
     "name": "1층"
    },
    {
     "rooms": [
      {
       "key": "attic",
       "type": "attic",
       "name": "다락",
       "x": 0,
       "y": 0,
       "w": 5700,
       "d": 4000,
       "open": [
        "e"
       ],
       "rail": [
        "e"
       ]
      }
     ],
     "openings": [
      {
       "roomKey": "attic",
       "side": "n",
       "pos": 1640,
       "winType": "double",
       "w": 1000,
       "h": 700,
       "sill": 300
      },
      {
       "roomKey": "attic",
       "side": "s",
       "pos": 4100,
       "winType": "double",
       "w": 2000,
       "h": 700,
       "sill": 300
      },
      {
       "roomKey": "attic",
       "side": "w",
       "pos": 2000,
       "winType": "fixed",
       "w": 2000,
       "h": 700,
       "sill": 200
      }
     ],
     "furniture": [],
     "name": "다락"
    }
   ]
  }
 },
 {
  "id": "cat-forest10-w-cube10w",
  "title": "FOREST10-W 10평 쉼터 (강화전시장)",
  "category": "체류형 쉼터",
  "showroom": "김포 본사전시장",
  "tags": [
   "카탈로그도면",
   "FOREST10-W",
   "10평 쉼터"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/forest10-w/1790757184845_vdehi1.webp?width=640&height=480&resize=cover&quality=70",
  "code": "FOREST10-W",
  "catSlugs": [
   "cube10w"
  ],
  "codeNote": "강화전시장",
  "source": "catalog-cad",
  "confidence": "medium",
  "base": {
   "name": "FOREST10-W 10평 쉼터",
   "productType": "체류형 쉼터",
   "ceilingHeight": 2400,
   "foundationHeight": 150,
   "wallThickness": 100,
   "exterior": {
    "material": "metal",
    "color": "#ece7dd",
    "dir": "v"
   },
   "roof": {
    "type": "flat",
    "color": "#ece7dd"
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "bed",
     "type": "bedroom",
     "name": "방",
     "x": 0,
     "y": 0,
     "w": 2660,
     "d": 3000
    },
    {
     "key": "bath",
     "type": "bath",
     "name": "욕실",
     "x": 2660,
     "y": 0,
     "w": 2620,
     "d": 1560
    },
    {
     "key": "kit",
     "type": "kitchen",
     "name": "주방",
     "x": 5280,
     "y": 0,
     "w": 4670,
     "d": 1560,
     "open": [
      "s",
      "e"
     ]
    },
    {
     "key": "liv",
     "type": "living",
     "name": "거실/현관",
     "x": 2660,
     "y": 1560,
     "w": 7290,
     "d": 1440,
     "open": [
      "n",
      "e"
     ]
    },
    {
     "key": "liv2",
     "type": "living",
     "name": "거실",
     "x": 9950,
     "y": 0,
     "w": 1050,
     "d": 3000,
     "open": [
      "w"
     ]
    }
   ],
   "openings": [
    {
     "roomKey": "bed",
     "side": "w",
     "pos": 1500,
     "winType": "double",
     "w": 1500,
     "h": 900,
     "sill": 1100
    },
    {
     "roomKey": "bed",
     "side": "s",
     "pos": 1350,
     "winType": "fixed",
     "w": 1800,
     "h": 800,
     "sill": 1200
    },
    {
     "roomKey": "bed",
     "side": "e",
     "pos": 2450,
     "winType": "swingDoor",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bath",
     "side": "n",
     "pos": 1040,
     "winType": "double",
     "w": 600,
     "h": 500,
     "sill": 1500
    },
    {
     "roomKey": "bath",
     "side": "s",
     "pos": 440,
     "winType": "swingDoor",
     "w": 700,
     "h": 1900,
     "sill": 0
    },
    {
     "roomKey": "kit",
     "side": "n",
     "pos": 2070,
     "winType": "double",
     "w": 1500,
     "h": 700,
     "sill": 1050
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 510,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 3200,
     "winType": "fixed",
     "w": 2000,
     "h": 800,
     "sill": 1200
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 6240,
     "winType": "balcony",
     "w": 2000,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "liv2",
     "side": "e",
     "pos": 1500,
     "winType": "double",
     "w": 2000,
     "h": 1200,
     "sill": 800
    }
   ],
   "furniture": [
    {
     "catalogId": "basin",
     "x": 3070,
     "y": 330,
     "rotation": 0
    },
    {
     "catalogId": "toilet",
     "x": 3750,
     "y": 450,
     "rotation": 0
    },
    {
     "catalogId": "washer",
     "x": 4960,
     "y": 420,
     "rotation": 0
    },
    {
     "catalogId": "fridge",
     "x": 5640,
     "y": 450,
     "rotation": 0
    },
    {
     "catalogId": "sink18",
     "x": 7230,
     "y": 400,
     "rotation": 0
    }
   ]
  }
 },
 {
  "id": "cat-stay14-5-3-gb",
  "title": "STAY14.5-3-GB 14.5평/3평 전원주택",
  "category": "주택",
  "showroom": "강화전시장",
  "tags": [
   "카탈로그도면",
   "STAY14.5-3-GB",
   "14.5평/3평 전원주택"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/misc/1781829318146_qoahbs.png?width=640&height=480&resize=cover&quality=70",
  "code": "STAY14.5-3-GB",
  "catSlugs": [
   "stay16-3gb",
   "stay18-b"
  ],
  "source": "catalog-cad",
  "confidence": "medium",
  "base": {
   "name": "STAY14.5-3-GB 14.5평/3평 전원주택",
   "productType": "주택",
   "ceilingHeight": 2400,
   "foundationHeight": 150,
   "wallThickness": 280,
   "exterior": {
    "material": "metal",
    "color": "#8d96a0",
    "corner": "#2f3237"
   },
   "roof": {
    "type": "gable",
    "color": "#2b2f33",
    "ridge": "z",
    "rise": 600
   },
   "wallThicknessInt": 120,
   "floors": [
    {
     "rooms": [
      {
       "key": "bed",
       "type": "bedroom",
       "name": "방",
       "x": 0,
       "y": 1500,
       "w": 2940,
       "d": 3500
      },
      {
       "key": "bath",
       "type": "bath",
       "name": "욕실",
       "x": 2940,
       "y": 1500,
       "w": 2520,
       "d": 1740
      },
      {
       "key": "util",
       "type": "utility",
       "name": "다용도실",
       "x": 5460,
       "y": 1500,
       "w": 2040,
       "d": 1740
      },
      {
       "key": "hall",
       "type": "hall",
       "name": "현관/홀",
       "x": 2940,
       "y": 3240,
       "w": 4560,
       "d": 1760,
       "open": [
        "e"
       ]
      },
      {
       "key": "kit",
       "type": "kitchen",
       "name": "주방",
       "x": 7500,
       "y": 0,
       "w": 3500,
       "d": 3240,
       "open": [
        "s"
       ]
      },
      {
       "key": "pass",
       "type": "hall",
       "name": "통로",
       "x": 7500,
       "y": 3240,
       "w": 3500,
       "d": 1760,
       "open": [
        "n",
        "w",
        "s"
       ]
      },
      {
       "key": "liv",
       "type": "living",
       "name": "거실",
       "x": 7500,
       "y": 5000,
       "w": 3500,
       "d": 2500,
       "open": [
        "n"
       ]
      },
      {
       "key": "deckN",
       "type": "deck",
       "name": "데크(3평)",
       "x": 0,
       "y": 0,
       "w": 7500,
       "d": 1500
      },
      {
       "key": "deckS",
       "type": "deck",
       "name": "데크(6평)",
       "x": 0,
       "y": 5000,
       "w": 7500,
       "d": 2500
      }
     ],
     "openings": [
      {
       "roomKey": "bed",
       "side": "w",
       "pos": 2050,
       "winType": "fixed",
       "w": 1300,
       "h": 1000,
       "sill": 1100
      },
      {
       "roomKey": "bed",
       "side": "s",
       "pos": 1550,
       "winType": "double",
       "w": 1500,
       "h": 1200,
       "sill": 1000
      },
      {
       "roomKey": "bed",
       "side": "e",
       "pos": 2660,
       "winType": "swingDoor",
       "w": 900,
       "h": 2100,
       "sill": 0
      },
      {
       "roomKey": "bath",
       "side": "n",
       "pos": 560,
       "winType": "double",
       "w": 600,
       "h": 500,
       "sill": 1500
      },
      {
       "roomKey": "bath",
       "side": "s",
       "pos": 450,
       "winType": "swingDoor",
       "w": 700,
       "h": 2000,
       "sill": 0
      },
      {
       "roomKey": "util",
       "side": "n",
       "pos": 1040,
       "winType": "double",
       "w": 800,
       "h": 600,
       "sill": 1400
      },
      {
       "roomKey": "util",
       "side": "s",
       "pos": 1390,
       "winType": "swingDoor",
       "w": 900,
       "h": 2000,
       "sill": 0
      },
      {
       "roomKey": "hall",
       "side": "s",
       "pos": 1560,
       "winType": "double",
       "w": 2000,
       "h": 1200,
       "sill": 1000
      },
      {
       "roomKey": "hall",
       "side": "s",
       "pos": 3910,
       "winType": "door",
       "w": 900,
       "h": 2100,
       "sill": 0
      },
      {
       "roomKey": "kit",
       "side": "n",
       "pos": 1750,
       "winType": "double",
       "w": 1500,
       "h": 1000,
       "sill": 1000
      },
      {
       "roomKey": "kit",
       "side": "e",
       "pos": 1750,
       "winType": "double",
       "w": 1500,
       "h": 500,
       "sill": 1100
      },
      {
       "roomKey": "kit",
       "side": "w",
       "pos": 670,
       "winType": "door",
       "w": 800,
       "h": 1800,
       "sill": 0
      },
      {
       "roomKey": "pass",
       "side": "e",
       "pos": 760,
       "winType": "fixed",
       "w": 600,
       "h": 1200,
       "sill": 600
      },
      {
       "roomKey": "liv",
       "side": "e",
       "pos": 1300,
       "winType": "fixed",
       "w": 600,
       "h": 1200,
       "sill": 600
      },
      {
       "roomKey": "liv",
       "side": "s",
       "pos": 1750,
       "winType": "balcony",
       "w": 2000,
       "h": 2100,
       "sill": 100
      }
     ],
     "furniture": [
      {
       "catalogId": "toilet",
       "x": 3440,
       "y": 2150,
       "rotation": 0
      },
      {
       "catalogId": "basin",
       "x": 4230,
       "y": 2030,
       "rotation": 0
      },
      {
       "catalogId": "washer",
       "x": 5840,
       "y": 2920,
       "rotation": 270
      },
      {
       "catalogId": "stairs",
       "x": 8120,
       "y": 2170,
       "rotation": 0
      },
      {
       "catalogId": "induction",
       "x": 10420,
       "y": 560,
       "rotation": 90
      },
      {
       "catalogId": "sink18",
       "x": 10420,
       "y": 1880,
       "rotation": 90
      },
      {
       "catalogId": "sofa3",
       "x": 10250,
       "y": 6140,
       "rotation": 90
      },
      {
       "catalogId": "tvstand",
       "x": 8150,
       "y": 6200,
       "rotation": 270
      }
     ],
     "name": "1층"
    },
    {
     "rooms": [
      {
       "key": "attic",
       "type": "attic",
       "name": "다락",
       "x": 7500,
       "y": 0,
       "w": 3500,
       "d": 3300
      }
     ],
     "openings": [
      {
       "roomKey": "attic",
       "side": "n",
       "pos": 1750,
       "winType": "double",
       "w": 1500,
       "h": 500,
       "sill": 550
      },
      {
       "roomKey": "attic",
       "side": "e",
       "pos": 1750,
       "winType": "double",
       "w": 1500,
       "h": 500,
       "sill": 350
      }
     ],
     "furniture": [],
     "name": "다락"
    }
   ]
  }
 },
 {
  "id": "cat-stay18-ub",
  "title": "STAY18-UB 19평 전원주택",
  "category": "주택",
  "showroom": "강화전시장",
  "tags": [
   "카탈로그도면",
   "STAY18-UB",
   "19평 전원주택"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/stay18k/1781766474535_96hxxc.png?width=640&height=480&resize=cover&quality=70",
  "code": "STAY18-UB",
  "catSlugs": [
   "stay18k"
  ],
  "source": "catalog-cad",
  "confidence": "high",
  "base": {
   "name": "STAY19-UB 19평 전원주택",
   "productType": "주택",
   "ceilingHeight": 2400,
   "foundationHeight": 400,
   "wallThickness": 280,
   "exterior": {
    "material": "metal",
    "color": "#f4f1ea"
   },
   "roof": {
    "type": "gable",
    "color": "#3a3f44",
    "ridge": "x",
    "rise": 900
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "kit",
     "type": "kitchen",
     "name": "주방",
     "x": 2540,
     "y": 0,
     "w": 5120,
     "d": 3440,
     "open": [
      "s",
      "w",
      "e"
     ]
    },
    {
     "key": "bath1",
     "type": "bath",
     "name": "공용욕실",
     "x": 0,
     "y": 0,
     "w": 2540,
     "d": 1970
    },
    {
     "key": "ent",
     "type": "entrance",
     "name": "현관",
     "x": 0,
     "y": 1970,
     "w": 1590,
     "d": 1470
    },
    {
     "key": "hall",
     "type": "hall",
     "name": "복도",
     "x": 1590,
     "y": 1970,
     "w": 950,
     "d": 1470,
     "open": [
      "e"
     ]
    },
    {
     "key": "bath2",
     "type": "bath",
     "name": "욕실",
     "x": 7660,
     "y": 0,
     "w": 2040,
     "d": 2520
    },
    {
     "key": "wash",
     "type": "utility",
     "name": "건식세면대",
     "x": 7660,
     "y": 2520,
     "w": 2040,
     "d": 920,
     "open": [
      "w"
     ]
    },
    {
     "key": "bed1",
     "type": "bedroom",
     "name": "방1",
     "x": 0,
     "y": 3440,
     "w": 2940,
     "d": 3560
    },
    {
     "key": "liv",
     "type": "living",
     "name": "거실",
     "x": 2940,
     "y": 3440,
     "w": 3820,
     "d": 3560,
     "open": [
      "n"
     ]
    },
    {
     "key": "bed2",
     "type": "bedroom",
     "name": "방2",
     "x": 6760,
     "y": 3440,
     "w": 2940,
     "d": 3560
    },
    {
     "key": "porch",
     "type": "porch",
     "name": "포치(7평)",
     "x": 0,
     "y": 7000,
     "w": 9700,
     "d": 2500,
     "rail": [
      "s",
      "e"
     ]
    },
    {
     "key": "deck",
     "type": "deck",
     "name": "데크(4평)",
     "x": -1500,
     "y": 0,
     "w": 1500,
     "d": 9500,
     "rail": [
      "w"
     ]
    }
   ],
   "openings": [
    {
     "roomKey": "bath1",
     "side": "n",
     "pos": 1380,
     "winType": "double",
     "w": 1000,
     "h": 900,
     "sill": 1200
    },
    {
     "roomKey": "kit",
     "side": "n",
     "pos": 1610,
     "winType": "double",
     "w": 1500,
     "h": 600,
     "sill": 1100
    },
    {
     "roomKey": "bath2",
     "side": "n",
     "pos": 1060,
     "winType": "double",
     "w": 600,
     "h": 500,
     "sill": 1600
    },
    {
     "roomKey": "ent",
     "side": "w",
     "pos": 860,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "ent",
     "side": "e",
     "pos": 735,
     "winType": "glassSlide",
     "w": 1350,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bath1",
     "side": "s",
     "pos": 2050,
     "winType": "swingDoor",
     "w": 800,
     "h": 2000,
     "sill": 0
    },
    {
     "roomKey": "bath2",
     "side": "s",
     "pos": 460,
     "winType": "swingDoor",
     "w": 700,
     "h": 2000,
     "sill": 0
    },
    {
     "roomKey": "bed1",
     "side": "n",
     "pos": 2430,
     "winType": "swingDoor",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bed2",
     "side": "n",
     "pos": 530,
     "winType": "swingDoor",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bed1",
     "side": "w",
     "pos": 2230,
     "winType": "double",
     "w": 1500,
     "h": 1000,
     "sill": 1100
    },
    {
     "roomKey": "bed2",
     "side": "e",
     "pos": 2230,
     "winType": "double",
     "w": 1500,
     "h": 1000,
     "sill": 1100
    },
    {
     "roomKey": "bed1",
     "side": "s",
     "pos": 1580,
     "winType": "fixed",
     "w": 1500,
     "h": 1000,
     "sill": 1100
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 1560,
     "winType": "balcony",
     "w": 1900,
     "h": 2100,
     "sill": 100
    },
    {
     "roomKey": "bed2",
     "side": "s",
     "pos": 1360,
     "winType": "fixed",
     "w": 1500,
     "h": 1000,
     "sill": 1100
    }
   ],
   "furniture": [
    {
     "catalogId": "basin",
     "x": 1380,
     "y": 470,
     "rotation": 0
    },
    {
     "catalogId": "toilet",
     "x": 2130,
     "y": 790,
     "rotation": 0
    },
    {
     "catalogId": "washer",
     "x": 690,
     "y": 1450,
     "rotation": 270
    },
    {
     "catalogId": "toilet",
     "x": 8930,
     "y": 2000,
     "rotation": 90
    },
    {
     "catalogId": "basin",
     "x": 9200,
     "y": 2970,
     "rotation": 90
    },
    {
     "catalogId": "sink",
     "x": 3800,
     "y": 655,
     "rotation": 0
    },
    {
     "catalogId": "fridge",
     "x": 7090,
     "y": 640,
     "rotation": 0
    }
   ]
  }
 },
 {
  "id": "cat-stay20-r",
  "title": "STAY20-R 20평 전원주택",
  "category": "주택",
  "showroom": "김포 본사전시장",
  "tags": [
   "카탈로그도면",
   "STAY20-R",
   "20평 전원주택"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/misc/1782957082310_e5olpp.png?width=640&height=480&resize=cover&quality=70",
  "code": "STAY20-R",
  "catSlugs": [
   "stay20r"
  ],
  "source": "catalog-cad",
  "confidence": "medium",
  "base": {
   "name": "STAY20-R 20평 전원주택",
   "productType": "주택",
   "ceilingHeight": 2400,
   "foundationHeight": 150,
   "wallThickness": 280,
   "exterior": {
    "material": "metal",
    "color": "#f4f1ea"
   },
   "roof": {
    "type": "gable",
    "color": "#5e442a",
    "ridge": "z",
    "rise": 1550
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "bed1",
     "type": "bedroom",
     "name": "침실1",
     "x": 0,
     "y": 0,
     "w": 2640,
     "d": 3260
    },
    {
     "key": "bed2",
     "type": "bedroom",
     "name": "침실2",
     "x": 0,
     "y": 3260,
     "w": 2640,
     "d": 3040
    },
    {
     "key": "bath1",
     "type": "bath",
     "name": "공용욕실",
     "x": 2640,
     "y": 0,
     "w": 2320,
     "d": 1740
    },
    {
     "key": "kit",
     "type": "kitchen",
     "name": "주방",
     "x": 4960,
     "y": 0,
     "w": 3380,
     "d": 1740,
     "open": [
      "s"
     ]
    },
    {
     "key": "hall",
     "type": "hall",
     "name": "복도",
     "x": 2640,
     "y": 1740,
     "w": 1550,
     "d": 2840,
     "open": [
      "e"
     ]
    },
    {
     "key": "ent",
     "type": "entrance",
     "name": "현관",
     "x": 2640,
     "y": 4580,
     "w": 1550,
     "d": 1720
    },
    {
     "key": "din",
     "type": "living",
     "name": "거실(식당)",
     "x": 4190,
     "y": 1740,
     "w": 4150,
     "d": 2840,
     "open": [
      "n",
      "w",
      "s"
     ]
    },
    {
     "key": "liv",
     "type": "living",
     "name": "거실",
     "x": 4190,
     "y": 4580,
     "w": 4150,
     "d": 2420,
     "open": [
      "n"
     ]
    },
    {
     "key": "bath2",
     "type": "bath",
     "name": "부부욕실",
     "x": 8340,
     "y": 1080,
     "w": 1440,
     "d": 2260
    },
    {
     "key": "dress",
     "type": "dress",
     "name": "드레스룸",
     "x": 9780,
     "y": 1080,
     "w": 1820,
     "d": 1340,
     "open": [
      "s"
     ]
    },
    {
     "key": "powder",
     "type": "dress",
     "name": "파우더룸",
     "x": 9780,
     "y": 2420,
     "w": 1820,
     "d": 920,
     "open": [
      "n"
     ]
    },
    {
     "key": "bed3",
     "type": "bedroom",
     "name": "안방",
     "x": 8340,
     "y": 3340,
     "w": 3260,
     "d": 2960
    },
    {
     "key": "deckL",
     "type": "deck",
     "name": "데크",
     "x": 0,
     "y": 6300,
     "w": 4190,
     "d": 700
    },
    {
     "key": "deckR",
     "type": "deck",
     "name": "데크",
     "x": 8340,
     "y": 6300,
     "w": 3260,
     "d": 700
    }
   ],
   "openings": [
    {
     "roomKey": "bed1",
     "side": "n",
     "pos": 1430,
     "winType": "double",
     "w": 1200,
     "h": 1000,
     "sill": 1100
    },
    {
     "roomKey": "bed1",
     "side": "w",
     "pos": 1230,
     "winType": "fixed",
     "w": 1200,
     "h": 800,
     "sill": 1300
    },
    {
     "roomKey": "bed1",
     "side": "e",
     "pos": 2760,
     "winType": "swingDoor",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bed2",
     "side": "w",
     "pos": 1810,
     "winType": "fixed",
     "w": 1200,
     "h": 800,
     "sill": 1300
    },
    {
     "roomKey": "bed2",
     "side": "s",
     "pos": 1430,
     "winType": "double",
     "w": 1200,
     "h": 1000,
     "sill": 1100
    },
    {
     "roomKey": "bed2",
     "side": "e",
     "pos": 730,
     "winType": "swingDoor",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bath1",
     "side": "s",
     "pos": 410,
     "winType": "swingDoor",
     "w": 700,
     "h": 2000,
     "sill": 0
    },
    {
     "roomKey": "kit",
     "side": "n",
     "pos": 2290,
     "winType": "double",
     "w": 1200,
     "h": 700,
     "sill": 1050
    },
    {
     "roomKey": "ent",
     "side": "n",
     "pos": 735,
     "winType": "glassSlide",
     "w": 1350,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "ent",
     "side": "s",
     "pos": 860,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 2075,
     "winType": "balcony",
     "w": 2500,
     "h": 2000,
     "sill": 100
    },
    {
     "roomKey": "bath2",
     "side": "n",
     "pos": 880,
     "winType": "double",
     "w": 600,
     "h": 500,
     "sill": 1700
    },
    {
     "roomKey": "bath2",
     "side": "s",
     "pos": 1070,
     "winType": "swingDoor",
     "w": 700,
     "h": 2000,
     "sill": 0
    },
    {
     "roomKey": "powder",
     "side": "s",
     "pos": 420,
     "winType": "pocketDoor",
     "w": 700,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bed3",
     "side": "e",
     "pos": 1730,
     "winType": "fixed",
     "w": 1200,
     "h": 800,
     "sill": 1300
    },
    {
     "roomKey": "bed3",
     "side": "s",
     "pos": 1700,
     "winType": "double",
     "w": 1700,
     "h": 1000,
     "sill": 1100
    }
   ],
   "furniture": [
    {
     "catalogId": "toilet",
     "x": 3130,
     "y": 730,
     "rotation": 0
    },
    {
     "catalogId": "basin",
     "x": 3790,
     "y": 490,
     "rotation": 0
    },
    {
     "catalogId": "fridge",
     "x": 5500,
     "y": 580,
     "rotation": 0
    },
    {
     "catalogId": "sink18",
     "x": 7250,
     "y": 580,
     "rotation": 0
    },
    {
     "catalogId": "induction",
     "x": 7900,
     "y": 1490,
     "rotation": 90
    },
    {
     "catalogId": "toilet",
     "x": 8840,
     "y": 2890,
     "rotation": 270
    },
    {
     "catalogId": "basin",
     "x": 8710,
     "y": 1730,
     "rotation": 270
    }
   ]
  }
 },
 {
  "id": "cat-stay10-6-w-stay16w",
  "title": "STAY10-6-W 16평 전원주택 (1전시장)",
  "category": "주택",
  "showroom": "김포 본사전시장",
  "tags": [
   "카탈로그도면",
   "STAY10-6-W",
   "16평 전원주택"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/stay10-wx2/1790757660749_iq487f.webp?width=640&height=480&resize=cover&quality=70",
  "code": "STAY10-6-W",
  "catSlugs": [
   "stay16w"
  ],
  "codeNote": "1전시장",
  "source": "catalog-cad",
  "confidence": "medium",
  "base": {
   "name": "STAY10-6-W 16평 전원주택 (1전시장)",
   "productType": "주택",
   "ceilingHeight": 2400,
   "foundationHeight": 300,
   "wallThickness": 280,
   "exterior": {
    "material": "metal",
    "color": "#f4f1ea",
    "dir": "v"
   },
   "roof": {
    "type": "shed",
    "color": "#3a3f44",
    "rise": 600
   },
   "wallThicknessInt": 120,
   "floors": [
    {
     "rooms": [
      {
       "key": "liv",
       "type": "living",
       "name": "거실",
       "x": 0,
       "y": 0,
       "w": 4960,
       "d": 4000,
       "open": [
        "e"
       ]
      },
      {
       "key": "stair",
       "type": "utility",
       "name": "계단·다용도실",
       "x": 4960,
       "y": 0,
       "w": 4240,
       "d": 1040,
       "open": [
        "w"
       ]
      },
      {
       "key": "kit",
       "type": "kitchen",
       "name": "주방",
       "x": 4960,
       "y": 1040,
       "w": 2960,
       "d": 1520,
       "open": [
        "w",
        "s",
        "e"
       ]
      },
      {
       "key": "ent",
       "type": "entrance",
       "name": "현관",
       "x": 7920,
       "y": 1040,
       "w": 1280,
       "d": 1520,
       "open": [
        "w"
       ]
      },
      {
       "key": "liv2",
       "type": "living",
       "name": "거실",
       "x": 4960,
       "y": 2560,
       "w": 860,
       "d": 1440,
       "open": [
        "w",
        "n"
       ]
      },
      {
       "key": "bath",
       "type": "bath",
       "name": "욕실",
       "x": 5820,
       "y": 2560,
       "w": 3380,
       "d": 1440
      }
     ],
     "openings": [
      {
       "roomKey": "liv",
       "side": "n",
       "pos": 2020,
       "winType": "double",
       "w": 2000,
       "h": 1400,
       "sill": 600
      },
      {
       "roomKey": "liv",
       "side": "w",
       "pos": 2000,
       "winType": "fixed",
       "w": 2000,
       "h": 1400,
       "sill": 600
      },
      {
       "roomKey": "liv",
       "side": "s",
       "pos": 1770,
       "winType": "folding",
       "w": 2500,
       "h": 2100,
       "sill": 0
      },
      {
       "roomKey": "ent",
       "side": "e",
       "pos": 960,
       "winType": "door",
       "w": 900,
       "h": 2100,
       "sill": 0
      },
      {
       "roomKey": "stair",
       "side": "n",
       "pos": 3585,
       "winType": "door",
       "w": 750,
       "h": 1550,
       "sill": 0
      },
      {
       "roomKey": "bath",
       "side": "n",
       "pos": 1630,
       "winType": "pocketDoor",
       "w": 700,
       "h": 2100,
       "sill": 0
      }
     ],
     "furniture": [
      {
       "catalogId": "stairs",
       "x": 6590,
       "y": 630,
       "rotation": 90
      },
      {
       "catalogId": "fridge",
       "x": 5360,
       "y": 1400,
       "rotation": 0
      },
      {
       "catalogId": "sink18",
       "x": 6840,
       "y": 1400,
       "rotation": 0
      },
      {
       "catalogId": "toilet",
       "x": 8410,
       "y": 3340,
       "rotation": 180
      },
      {
       "catalogId": "basin",
       "x": 7450,
       "y": 3560,
       "rotation": 180
      }
     ],
     "name": "1층"
    },
    {
     "rooms": [
      {
       "key": "deck2",
       "type": "deck",
       "name": "합성데크",
       "x": 0,
       "y": 0,
       "w": 3500,
       "d": 4000,
       "rail": [
        "n",
        "w",
        "s"
       ]
      },
      {
       "key": "a_nw",
       "type": "room",
       "name": "다락",
       "x": 3500,
       "y": 0,
       "w": 2540,
       "d": 1040,
       "open": [
        "s"
       ]
      },
      {
       "key": "a_stair",
       "type": "hall",
       "name": "계단실",
       "x": 6040,
       "y": 0,
       "w": 2180,
       "d": 1040,
       "open": [
        "e"
       ]
      },
      {
       "key": "a_land",
       "type": "hall",
       "name": "계단참",
       "x": 8220,
       "y": 0,
       "w": 980,
       "d": 1040,
       "open": [
        "w",
        "s"
       ]
      },
      {
       "key": "a_main",
       "type": "room",
       "name": "다락",
       "x": 3500,
       "y": 1040,
       "w": 4160,
       "d": 2960,
       "open": [
        "n",
        "e"
       ]
      },
      {
       "key": "a_e",
       "type": "room",
       "name": "다락",
       "x": 7660,
       "y": 1040,
       "w": 1540,
       "d": 1120,
       "open": [
        "w",
        "n"
       ]
      },
      {
       "key": "a_bath",
       "type": "bath",
       "name": "화장실",
       "x": 7660,
       "y": 2160,
       "w": 1540,
       "d": 1840
      }
     ],
     "openings": [
      {
       "roomKey": "a_main",
       "side": "w",
       "pos": 450,
       "winType": "door",
       "w": 900,
       "h": 2100,
       "sill": 0
      },
      {
       "roomKey": "a_main",
       "side": "w",
       "pos": 1730,
       "winType": "fixed",
       "w": 1500,
       "h": 1400,
       "sill": 600
      },
      {
       "roomKey": "a_main",
       "side": "s",
       "pos": 2050,
       "winType": "double",
       "w": 1500,
       "h": 1400,
       "sill": 600
      },
      {
       "roomKey": "a_land",
       "side": "e",
       "pos": 690,
       "winType": "fixed",
       "w": 500,
       "h": 1500,
       "sill": 600
      },
      {
       "roomKey": "a_e",
       "side": "e",
       "pos": 560,
       "winType": "double",
       "w": 800,
       "h": 1400,
       "sill": 600
      },
      {
       "roomKey": "a_bath",
       "side": "n",
       "pos": 440,
       "winType": "swingDoor",
       "w": 700,
       "h": 1900,
       "sill": 0
      }
     ],
     "furniture": [
      {
       "catalogId": "basin",
       "x": 8720,
       "y": 2630,
       "rotation": 90
      },
      {
       "catalogId": "toilet",
       "x": 8480,
       "y": 3340,
       "rotation": 90
      }
     ],
     "name": "다락"
    }
   ]
  }
 },
 {
  "id": "cat-stay15-b",
  "title": "STAY15-B 15평 전원주택",
  "category": "주택",
  "showroom": "김포 제1전시장",
  "tags": [
   "카탈로그도면",
   "STAY15-B",
   "15평 전원주택"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/stay15c/1782108539363_lrn9fw.png?width=640&height=480&resize=cover&quality=70",
  "code": "STAY15-B",
  "catSlugs": [
   "stay15c"
  ],
  "source": "catalog-cad",
  "confidence": "medium",
  "base": {
   "name": "STAY-15-B 15평 전원주택",
   "productType": "주택",
   "ceilingHeight": 2400,
   "foundationHeight": 150,
   "wallThickness": 280,
   "exterior": {
    "material": "ceramic",
    "color": "#8d96a0"
   },
   "roof": {
    "type": "asymGable",
    "color": "#3a3f44",
    "ridge": "x",
    "rise": 750
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "bed1",
     "type": "bedroom",
     "name": "침실1",
     "x": 0,
     "y": 0,
     "w": 2420,
     "d": 2540
    },
    {
     "key": "bath",
     "type": "bath",
     "name": "욕실",
     "x": 2420,
     "y": 0,
     "w": 1520,
     "d": 2540
    },
    {
     "key": "hall",
     "type": "hall",
     "name": "복도",
     "x": 0,
     "y": 2540,
     "w": 3940,
     "d": 1120,
     "open": [
      "e"
     ]
    },
    {
     "key": "ent",
     "type": "entrance",
     "name": "현관",
     "x": 0,
     "y": 3660,
     "w": 1600,
     "d": 1340
    },
    {
     "key": "bed2",
     "type": "bedroom",
     "name": "침실2",
     "x": 1600,
     "y": 3660,
     "w": 2340,
     "d": 3340
    },
    {
     "key": "kit",
     "type": "kitchen",
     "name": "주방/식당",
     "x": 3940,
     "y": 0,
     "w": 4260,
     "d": 3660,
     "open": [
      "s"
     ]
    },
    {
     "key": "liv",
     "type": "living",
     "name": "거실",
     "x": 3940,
     "y": 3660,
     "w": 4260,
     "d": 3340,
     "open": [
      "n"
     ]
    },
    {
     "key": "porch",
     "type": "porch",
     "name": "포치",
     "x": 0,
     "y": 5000,
     "w": 1600,
     "d": 2000
    }
   ],
   "openings": [
    {
     "roomKey": "bed1",
     "side": "n",
     "pos": 1320,
     "winType": "double",
     "w": 1000,
     "h": 900,
     "sill": 1100
    },
    {
     "roomKey": "bed1",
     "side": "w",
     "pos": 1130,
     "winType": "fixed",
     "w": 1200,
     "h": 800,
     "sill": 1200
    },
    {
     "roomKey": "bed1",
     "side": "s",
     "pos": 1910,
     "winType": "swingDoor",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bath",
     "side": "n",
     "pos": 760,
     "winType": "double",
     "w": 600,
     "h": 500,
     "sill": 1600
    },
    {
     "roomKey": "bath",
     "side": "s",
     "pos": 1055,
     "winType": "swingDoor",
     "w": 700,
     "h": 1900,
     "sill": 0
    },
    {
     "roomKey": "hall",
     "side": "w",
     "pos": 560,
     "winType": "fixed",
     "w": 600,
     "h": 1700,
     "sill": 400
    },
    {
     "roomKey": "ent",
     "side": "n",
     "pos": 880,
     "winType": "glassSlide",
     "w": 1200,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "ent",
     "side": "s",
     "pos": 960,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bed2",
     "side": "n",
     "pos": 1830,
     "winType": "swingDoor",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bed2",
     "side": "s",
     "pos": 1280,
     "winType": "double",
     "w": 1000,
     "h": 900,
     "sill": 900
    },
    {
     "roomKey": "kit",
     "side": "n",
     "pos": 2020,
     "winType": "double",
     "w": 1500,
     "h": 700,
     "sill": 1300
    },
    {
     "roomKey": "kit",
     "side": "e",
     "pos": 1360,
     "winType": "fixed",
     "w": 600,
     "h": 1700,
     "sill": 400
    },
    {
     "roomKey": "kit",
     "side": "e",
     "pos": 3080,
     "winType": "fixed",
     "w": 600,
     "h": 1700,
     "sill": 400
    },
    {
     "roomKey": "liv",
     "side": "e",
     "pos": 1710,
     "winType": "fixed",
     "w": 1700,
     "h": 800,
     "sill": 1200
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 2020,
     "winType": "balcony",
     "w": 2200,
     "h": 2100,
     "sill": 100
    }
   ],
   "furniture": [
    {
     "catalogId": "toilet",
     "x": 2930,
     "y": 1490,
     "rotation": 270
    },
    {
     "catalogId": "basin",
     "x": 2700,
     "y": 2070,
     "rotation": 270
    },
    {
     "catalogId": "fridge",
     "x": 4350,
     "y": 660,
     "rotation": 0
    },
    {
     "catalogId": "sink18",
     "x": 6300,
     "y": 655,
     "rotation": 0
    },
    {
     "catalogId": "induction2",
     "x": 7650,
     "y": 655,
     "rotation": 0
    }
   ]
  }
 },
 {
  "id": "cat-forest6-w",
  "title": "FOREST6-W 6평 체류형 쉼터",
  "category": "체류형 쉼터",
  "showroom": "김포 본사전시장",
  "tags": [
   "카탈로그도면",
   "FOREST6-W",
   "6평 체류형 쉼터"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/cube6-w/1790757446403_18g3ho.webp?width=640&height=480&resize=cover&quality=70",
  "code": "FOREST6-W",
  "catSlugs": [
   "cube6-w"
  ],
  "source": "catalog-cad",
  "confidence": "high",
  "base": {
   "name": "FOREST6-W 6평 체류형 쉼터",
   "productType": "체류형 쉼터",
   "ceilingHeight": 2300,
   "foundationHeight": 150,
   "wallThickness": 200,
   "exterior": {
    "material": "metal",
    "color": "#f4f1ea",
    "dir": "v"
   },
   "roof": {
    "type": "flat",
    "color": "#f4f1ea"
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "liv",
     "type": "living",
     "name": "거실/주방",
     "x": 0,
     "y": 0,
     "w": 4840,
     "d": 3000
    },
    {
     "key": "bath",
     "type": "bath",
     "name": "화장실",
     "x": 4840,
     "y": 0,
     "w": 1660,
     "d": 1860
    },
    {
     "key": "util",
     "type": "utility",
     "name": "붙박이장/온수기",
     "x": 4840,
     "y": 1860,
     "w": 1660,
     "d": 1140,
     "open": [
      "w"
     ]
    }
   ],
   "openings": [
    {
     "roomKey": "liv",
     "side": "n",
     "pos": 2500,
     "winType": "casement2",
     "w": 2000,
     "h": 1200,
     "sill": 700
    },
    {
     "roomKey": "liv",
     "side": "w",
     "pos": 1500,
     "winType": "fixed",
     "w": 1800,
     "h": 900,
     "sill": 900
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 2900,
     "winType": "foldSwing",
     "w": 2800,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bath",
     "side": "n",
     "pos": 810,
     "winType": "double",
     "w": 600,
     "h": 500,
     "sill": 1300
    },
    {
     "roomKey": "bath",
     "side": "s",
     "pos": 440,
     "winType": "swingDoor",
     "w": 700,
     "h": 1900,
     "sill": 0
    }
   ],
   "furniture": [
    {
     "catalogId": "induction2",
     "x": 4500,
     "y": 530,
     "rotation": 90
    },
    {
     "catalogId": "toilet",
     "x": 5920,
     "y": 530,
     "rotation": 90
    },
    {
     "catalogId": "basin",
     "x": 6050,
     "y": 1390,
     "rotation": 90
    }
   ]
  }
 },
 {
  "id": "cat-stay19-r",
  "title": "STAY19-R 19평 전원주택",
  "category": "주택",
  "showroom": "광주전시장",
  "tags": [
   "카탈로그도면",
   "STAY19-R",
   "19평 전원주택"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/stay19rb/1783582640072_y2og9p.jpg?width=640&height=480&resize=cover&quality=70",
  "code": "STAY19-R",
  "catSlugs": [
   "stay19rb"
  ],
  "source": "catalog-cad",
  "confidence": "high",
  "base": {
   "name": "STAY-19-R 19평 전원주택",
   "productType": "주택",
   "ceilingHeight": 2400,
   "foundationHeight": 300,
   "wallThickness": 280,
   "exterior": {
    "material": "metal",
    "color": "#a8654b"
   },
   "roof": {
    "type": "gable",
    "color": "#3a3f44",
    "ridge": "x",
    "rise": 900
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "util",
     "type": "utility",
     "name": "다용도실/보일러실",
     "x": 0,
     "y": 0,
     "w": 2540,
     "d": 1970
    },
    {
     "key": "kit",
     "type": "kitchen",
     "name": "주방",
     "x": 2540,
     "y": 0,
     "w": 5120,
     "d": 1970,
     "open": [
      "s"
     ]
    },
    {
     "key": "bath",
     "type": "bath",
     "name": "욕실",
     "x": 7660,
     "y": 0,
     "w": 2040,
     "d": 2520
    },
    {
     "key": "ent",
     "type": "entrance",
     "name": "현관",
     "x": 0,
     "y": 1970,
     "w": 1550,
     "d": 1470
    },
    {
     "key": "hall",
     "type": "hall",
     "name": "식당/홀",
     "x": 1550,
     "y": 1970,
     "w": 6110,
     "d": 1470,
     "open": [
      "n",
      "s",
      "e"
     ]
    },
    {
     "key": "wash",
     "type": "bath",
     "name": "건식세면대",
     "x": 7660,
     "y": 2520,
     "w": 2040,
     "d": 920,
     "open": [
      "w"
     ]
    },
    {
     "key": "bed1",
     "type": "bedroom",
     "name": "방1",
     "x": 0,
     "y": 3440,
     "w": 2940,
     "d": 3560
    },
    {
     "key": "liv",
     "type": "living",
     "name": "거실",
     "x": 2940,
     "y": 3440,
     "w": 3820,
     "d": 3560,
     "open": [
      "n"
     ]
    },
    {
     "key": "bed2",
     "type": "bedroom",
     "name": "방2",
     "x": 6760,
     "y": 3440,
     "w": 2940,
     "d": 3560
    },
    {
     "key": "deck",
     "type": "deck",
     "name": "데크",
     "x": -1500,
     "y": 0,
     "w": 1500,
     "d": 9500
    },
    {
     "key": "porch",
     "type": "porch",
     "name": "포치",
     "x": 0,
     "y": 7000,
     "w": 9700,
     "d": 2500,
     "rail": [
      "s"
     ]
    }
   ],
   "openings": [
    {
     "roomKey": "util",
     "side": "n",
     "pos": 1380,
     "winType": "double",
     "w": 1000,
     "h": 900,
     "sill": 1200
    },
    {
     "roomKey": "util",
     "side": "s",
     "pos": 2030,
     "winType": "swingDoor",
     "w": 800,
     "h": 2000,
     "sill": 0
    },
    {
     "roomKey": "kit",
     "side": "n",
     "pos": 1610,
     "winType": "double",
     "w": 1500,
     "h": 600,
     "sill": 1100
    },
    {
     "roomKey": "bath",
     "side": "n",
     "pos": 1060,
     "winType": "double",
     "w": 600,
     "h": 500,
     "sill": 1600
    },
    {
     "roomKey": "bath",
     "side": "s",
     "pos": 450,
     "winType": "swingDoor",
     "w": 700,
     "h": 2000,
     "sill": 0
    },
    {
     "roomKey": "ent",
     "side": "w",
     "pos": 860,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "ent",
     "side": "e",
     "pos": 735,
     "winType": "glassSlide",
     "w": 1350,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bed1",
     "side": "n",
     "pos": 2430,
     "winType": "swingDoor",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bed1",
     "side": "w",
     "pos": 2230,
     "winType": "double",
     "w": 1500,
     "h": 1000,
     "sill": 1100
    },
    {
     "roomKey": "bed1",
     "side": "s",
     "pos": 1580,
     "winType": "fixed",
     "w": 1500,
     "h": 1000,
     "sill": 1100
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 1560,
     "winType": "balcony",
     "w": 1900,
     "h": 2100,
     "sill": 100
    },
    {
     "roomKey": "bed2",
     "side": "n",
     "pos": 510,
     "winType": "swingDoor",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bed2",
     "side": "s",
     "pos": 1360,
     "winType": "fixed",
     "w": 1500,
     "h": 1000,
     "sill": 1100
    },
    {
     "roomKey": "bed2",
     "side": "e",
     "pos": 2230,
     "winType": "double",
     "w": 1500,
     "h": 1000,
     "sill": 1100
    }
   ],
   "furniture": [
    {
     "catalogId": "basin",
     "x": 1370,
     "y": 490,
     "rotation": 0
    },
    {
     "catalogId": "toilet",
     "x": 2140,
     "y": 720,
     "rotation": 0
    },
    {
     "catalogId": "washer",
     "x": 700,
     "y": 1500,
     "rotation": 270
    },
    {
     "catalogId": "sink",
     "x": 3800,
     "y": 580,
     "rotation": 0
    },
    {
     "catalogId": "fridge",
     "x": 7110,
     "y": 580,
     "rotation": 0
    },
    {
     "catalogId": "basin",
     "x": 9220,
     "y": 1530,
     "rotation": 90
    },
    {
     "catalogId": "toilet",
     "x": 9000,
     "y": 1960,
     "rotation": 90
    },
    {
     "catalogId": "basin",
     "x": 9220,
     "y": 3200,
     "rotation": 90
    }
   ]
  }
 },
 {
  "id": "cat-cube-t4-k",
  "title": "CUBE-T4-K 4평 화장실",
  "category": "특별모델",
  "showroom": "김포 본사전시장",
  "tags": [
   "카탈로그도면",
   "CUBE-T4-K",
   "4평 화장실"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/cube4b.jpg?width=640&height=480&resize=cover&quality=70",
  "code": "CUBE-T4-K",
  "catSlugs": [
   "cube-4b"
  ],
  "source": "catalog-cad",
  "confidence": "medium",
  "base": {
   "name": "CUBE-T4-K 4평 화장실",
   "productType": "농막",
   "ceilingHeight": 2400,
   "foundationHeight": 300,
   "wallThickness": 100,
   "exterior": {
    "material": "metal",
    "color": "#8d96a0",
    "dir": "v"
   },
   "roof": {
    "type": "flat",
    "color": "#3a3f44"
   },
   "wallThicknessInt": 100,
   "rooms": [
    {
     "key": "mwc",
     "type": "bath",
     "name": "남자화장실",
     "x": 0,
     "y": 0,
     "w": 1300,
     "d": 2400
    },
    {
     "key": "ms1",
     "type": "bath",
     "name": "대변칸1",
     "x": 1300,
     "y": 0,
     "w": 1300,
     "d": 1200
    },
    {
     "key": "ms2",
     "type": "bath",
     "name": "대변칸2",
     "x": 1300,
     "y": 1200,
     "w": 1300,
     "d": 1200
    },
    {
     "key": "ws1",
     "type": "bath",
     "name": "대변칸3",
     "x": 2600,
     "y": 0,
     "w": 1320,
     "d": 1200
    },
    {
     "key": "ws2",
     "type": "bath",
     "name": "대변칸4",
     "x": 2600,
     "y": 1200,
     "w": 1320,
     "d": 1200
    },
    {
     "key": "wwc",
     "type": "bath",
     "name": "여자화장실",
     "x": 3920,
     "y": 0,
     "w": 1080,
     "d": 2400
    },
    {
     "key": "porch",
     "type": "porch",
     "name": "캐노피(합성데크)",
     "x": 0,
     "y": 2400,
     "w": 5000,
     "d": 1000
    }
   ],
   "openings": [
    {
     "roomKey": "mwc",
     "side": "n",
     "pos": 800,
     "winType": "casement",
     "w": 600,
     "h": 1500,
     "sill": 600
    },
    {
     "roomKey": "wwc",
     "side": "n",
     "pos": 380,
     "winType": "casement",
     "w": 600,
     "h": 1500,
     "sill": 600
    },
    {
     "roomKey": "mwc",
     "side": "s",
     "pos": 850,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "wwc",
     "side": "s",
     "pos": 480,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "ms1",
     "side": "w",
     "pos": 500,
     "winType": "swingDoor",
     "w": 600,
     "h": 1800,
     "sill": 0
    },
    {
     "roomKey": "ms2",
     "side": "w",
     "pos": 400,
     "winType": "swingDoor",
     "w": 600,
     "h": 1800,
     "sill": 0
    },
    {
     "roomKey": "ws1",
     "side": "e",
     "pos": 500,
     "winType": "swingDoor",
     "w": 600,
     "h": 1800,
     "sill": 0
    },
    {
     "roomKey": "ws2",
     "side": "e",
     "pos": 400,
     "winType": "swingDoor",
     "w": 600,
     "h": 1800,
     "sill": 0
    }
   ],
   "furniture": [
    {
     "catalogId": "toilet",
     "x": 2130,
     "y": 640,
     "rotation": 90
    },
    {
     "catalogId": "toilet",
     "x": 2130,
     "y": 1760,
     "rotation": 90
    },
    {
     "catalogId": "toilet",
     "x": 3060,
     "y": 640,
     "rotation": 270
    },
    {
     "catalogId": "toilet",
     "x": 3060,
     "y": 1750,
     "rotation": 270
    },
    {
     "catalogId": "basin",
     "x": 300,
     "y": 1950,
     "rotation": 270
    },
    {
     "catalogId": "basin",
     "x": 4690,
     "y": 1420,
     "rotation": 90
    }
   ]
  }
 },
 {
  "id": "cat-stay13-w",
  "title": "STAY13-W 13평 세컨하우스",
  "category": "주택",
  "showroom": "김포 본사전시장",
  "tags": [
   "카탈로그도면",
   "STAY13-W",
   "13평 세컨하우스"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/stay13w/1783562537616_78i4eq.png?width=640&height=480&resize=cover&quality=70",
  "code": "STAY13-W",
  "catSlugs": [
   "stay13w"
  ],
  "source": "catalog-cad",
  "confidence": "high",
  "base": {
   "name": "STAY-13-W 13평 세컨하우스",
   "productType": "주택",
   "ceilingHeight": 2400,
   "foundationHeight": 400,
   "wallThickness": 280,
   "exterior": {
    "material": "brick",
    "color": "#f4f1ea"
   },
   "roof": {
    "type": "hip",
    "color": "#3a3f44",
    "rise": 1500
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "kit",
     "type": "kitchen",
     "name": "주방",
     "x": 0,
     "y": 0,
     "w": 1820,
     "d": 3940,
     "open": [
      "e"
     ]
    },
    {
     "key": "liv",
     "type": "living",
     "name": "거실",
     "x": 1820,
     "y": 0,
     "w": 5780,
     "d": 3620,
     "open": [
      "w",
      "s"
     ]
    },
    {
     "key": "hall",
     "type": "hall",
     "name": "홀",
     "x": 1820,
     "y": 3620,
     "w": 1820,
     "d": 630,
     "open": [
      "n",
      "w"
     ]
    },
    {
     "key": "ent",
     "type": "entrance",
     "name": "현관",
     "x": 1820,
     "y": 4250,
     "w": 1820,
     "d": 1350
    },
    {
     "key": "bath",
     "type": "bath",
     "name": "욕실",
     "x": 0,
     "y": 3940,
     "w": 1820,
     "d": 2460
    },
    {
     "key": "bed",
     "type": "bedroom",
     "name": "방",
     "x": 3640,
     "y": 3620,
     "w": 3960,
     "d": 2780
    },
    {
     "key": "porch",
     "type": "porch",
     "name": "포치",
     "x": 2040,
     "y": 5600,
     "w": 1400,
     "d": 800
    }
   ],
   "openings": [
    {
     "roomKey": "kit",
     "side": "w",
     "pos": 1800,
     "winType": "double",
     "w": 1400,
     "h": 600,
     "sill": 1100
    },
    {
     "roomKey": "kit",
     "side": "n",
     "pos": 1360,
     "winType": "fixed",
     "w": 600,
     "h": 1800,
     "sill": 300
    },
    {
     "roomKey": "liv",
     "side": "n",
     "pos": 1440,
     "winType": "fixed",
     "w": 600,
     "h": 1800,
     "sill": 300
    },
    {
     "roomKey": "liv",
     "side": "n",
     "pos": 3870,
     "winType": "double",
     "w": 1500,
     "h": 600,
     "sill": 1500
    },
    {
     "roomKey": "liv",
     "side": "e",
     "pos": 1940,
     "winType": "double",
     "w": 2000,
     "h": 1500,
     "sill": 600
    },
    {
     "roomKey": "ent",
     "side": "n",
     "pos": 740,
     "winType": "glassSlide",
     "w": 1350,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "ent",
     "side": "s",
     "pos": 920,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bath",
     "side": "n",
     "pos": 1395,
     "winType": "swingDoor",
     "w": 700,
     "h": 2000,
     "sill": 0
    },
    {
     "roomKey": "bath",
     "side": "s",
     "pos": 1020,
     "winType": "double",
     "w": 600,
     "h": 500,
     "sill": 1500
    },
    {
     "roomKey": "bed",
     "side": "n",
     "pos": 440,
     "winType": "swingDoor",
     "w": 800,
     "h": 2000,
     "sill": 0
    },
    {
     "roomKey": "bed",
     "side": "s",
     "pos": 1880,
     "winType": "double",
     "w": 1500,
     "h": 800,
     "sill": 1300
    },
    {
     "roomKey": "bed",
     "side": "e",
     "pos": 1260,
     "winType": "fixed",
     "w": 1600,
     "h": 800,
     "sill": 1300
    }
   ],
   "furniture": [
    {
     "catalogId": "sink",
     "x": 580,
     "y": 1460,
     "rotation": 270
    },
    {
     "catalogId": "fridge",
     "x": 580,
     "y": 3550,
     "rotation": 270
    },
    {
     "catalogId": "toilet",
     "x": 780,
     "y": 4360,
     "rotation": 270
    },
    {
     "catalogId": "basin",
     "x": 550,
     "y": 5110,
     "rotation": 270
    }
   ]
  }
 },
 {
  "id": "cat-stay20-4-bw",
  "title": "STAY20-4-BW 20평+포치4평 체류형 쉼터",
  "category": "체류형 쉼터",
  "showroom": "김포 제1전시장",
  "tags": [
   "카탈로그도면",
   "STAY20-4-BW",
   "20평+포치4평 체류형 쉼터"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/stay24wb/1783316968100_98snhp.png?width=640&height=480&resize=cover&quality=70",
  "code": "STAY20-4-BW",
  "catSlugs": [
   "stay24wb"
  ],
  "source": "catalog-cad",
  "confidence": "medium",
  "base": {
   "name": "STAY20-4-BW 20평+포치4평 체류형 쉼터",
   "productType": "체류형 쉼터",
   "ceilingHeight": 2300,
   "foundationHeight": 150,
   "wallThickness": 280,
   "exterior": {
    "material": "metal",
    "color": "#2f3237",
    "dir": "v"
   },
   "roof": {
    "type": "asymGable",
    "color": "#3a3f44",
    "ridge": "z",
    "rise": 1500
   },
   "wallThicknessInt": 120,
   "floors": [
    {
     "rooms": [
      {
       "key": "liv",
       "type": "living",
       "name": "거실",
       "x": 0,
       "y": 0,
       "w": 4100,
       "d": 4000,
       "open": [
        "e"
       ]
      },
      {
       "key": "liv2",
       "type": "living",
       "name": "거실",
       "x": 4100,
       "y": 0,
       "w": 1250,
       "d": 2740,
       "open": [
        "w",
        "e"
       ]
      },
      {
       "key": "bath",
       "type": "bath",
       "name": "화장실",
       "x": 5350,
       "y": 0,
       "w": 2320,
       "d": 1740
      },
      {
       "key": "hall2",
       "type": "hall",
       "name": "복도",
       "x": 5350,
       "y": 1740,
       "w": 2320,
       "d": 1000,
       "open": [
        "w",
        "e",
        "s"
       ]
      },
      {
       "key": "hall",
       "type": "hall",
       "name": "복도",
       "x": 7670,
       "y": 1060,
       "w": 820,
       "d": 1680,
       "open": [
        "n",
        "w",
        "s"
       ]
      },
      {
       "key": "stair",
       "type": "hall",
       "name": "계단",
       "x": 7670,
       "y": 0,
       "w": 1500,
       "d": 1060,
       "open": [
        "s"
       ]
      },
      {
       "key": "boil",
       "type": "utility",
       "name": "보일러실",
       "x": 9170,
       "y": 0,
       "w": 2130,
       "d": 1060
      },
      {
       "key": "bed",
       "type": "bedroom",
       "name": "방",
       "x": 8490,
       "y": 1060,
       "w": 2810,
       "d": 2940
      },
      {
       "key": "kit",
       "type": "kitchen",
       "name": "주방",
       "x": 5570,
       "y": 2740,
       "w": 2920,
       "d": 1260,
       "open": [
        "n"
       ]
      },
      {
       "key": "ent",
       "type": "entrance",
       "name": "현관",
       "x": 4100,
       "y": 2740,
       "w": 1470,
       "d": 1260
      }
     ],
     "openings": [
      {
       "roomKey": "liv",
       "side": "n",
       "pos": 2800,
       "winType": "fixed",
       "w": 2000,
       "h": 800,
       "sill": 1000
      },
      {
       "roomKey": "liv",
       "side": "w",
       "pos": 2000,
       "winType": "fixed",
       "w": 2500,
       "h": 1500,
       "sill": 600
      },
      {
       "roomKey": "liv",
       "side": "s",
       "pos": 2170,
       "winType": "balcony",
       "w": 2000,
       "h": 2100,
       "sill": 100
      },
      {
       "roomKey": "ent",
       "side": "s",
       "pos": 510,
       "winType": "door",
       "w": 900,
       "h": 2100,
       "sill": 0
      },
      {
       "roomKey": "ent",
       "side": "n",
       "pos": 735,
       "winType": "glassSlide",
       "w": 1350,
       "h": 2100,
       "sill": 0
      },
      {
       "roomKey": "bath",
       "side": "s",
       "pos": 1880,
       "winType": "swingDoor",
       "w": 700,
       "h": 2000,
       "sill": 0
      },
      {
       "roomKey": "kit",
       "side": "s",
       "pos": 1810,
       "winType": "double",
       "w": 1500,
       "h": 600,
       "sill": 1100
      },
      {
       "roomKey": "boil",
       "side": "n",
       "pos": 1130,
       "winType": "double",
       "w": 800,
       "h": 600,
       "sill": 1000
      },
      {
       "roomKey": "boil",
       "side": "s",
       "pos": 1470,
       "winType": "swingDoor",
       "w": 700,
       "h": 2000,
       "sill": 0
      },
      {
       "roomKey": "bed",
       "side": "w",
       "pos": 550,
       "winType": "swingDoor",
       "w": 900,
       "h": 2100,
       "sill": 0
      },
      {
       "roomKey": "bed",
       "side": "e",
       "pos": 1340,
       "winType": "double",
       "w": 2000,
       "h": 900,
       "sill": 1000
      },
      {
       "roomKey": "bed",
       "side": "s",
       "pos": 1285,
       "winType": "fixed",
       "w": 1800,
       "h": 900,
       "sill": 1000
      }
     ],
     "furniture": [
      {
       "catalogId": "toilet",
       "x": 6600,
       "y": 640,
       "rotation": 0
      },
      {
       "catalogId": "basin",
       "x": 7270,
       "y": 530,
       "rotation": 0
      },
      {
       "catalogId": "fridge",
       "x": 5980,
       "y": 3370,
       "rotation": 180
      },
      {
       "catalogId": "sink18",
       "x": 7380,
       "y": 3420,
       "rotation": 180
      },
      {
       "catalogId": "stairs",
       "x": 9010,
       "y": 640,
       "rotation": 90
      }
     ],
     "name": "1층"
    },
    {
     "rooms": [
      {
       "key": "deck2",
       "type": "deck",
       "name": "데크(포치)",
       "x": 0,
       "y": 0,
       "w": 4300,
       "d": 4000,
       "rail": [
        "n",
        "w",
        "s"
       ]
      },
      {
       "key": "r2",
       "type": "room",
       "name": "2층 방",
       "x": 4300,
       "y": 0,
       "w": 7000,
       "d": 4000
      }
     ],
     "openings": [
      {
       "roomKey": "r2",
       "side": "n",
       "pos": 4950,
       "winType": "fixed",
       "w": 1500,
       "h": 800,
       "sill": 300
      },
      {
       "roomKey": "r2",
       "side": "w",
       "pos": 2400,
       "winType": "balcony",
       "w": 2000,
       "h": 2000,
       "sill": 0
      },
      {
       "roomKey": "r2",
       "side": "e",
       "pos": 650,
       "winType": "fixed",
       "w": 500,
       "h": 1500,
       "sill": 300
      },
      {
       "roomKey": "r2",
       "side": "e",
       "pos": 2650,
       "winType": "fixed",
       "w": 1200,
       "h": 1500,
       "sill": 500
      },
      {
       "roomKey": "r2",
       "side": "s",
       "pos": 2350,
       "winType": "fixed",
       "w": 700,
       "h": 1800,
       "sill": 200
      },
      {
       "roomKey": "r2",
       "side": "s",
       "pos": 4150,
       "winType": "double",
       "w": 1500,
       "h": 1000,
       "sill": 1000
      },
      {
       "roomKey": "r2",
       "side": "s",
       "pos": 5900,
       "winType": "fixed",
       "w": 1000,
       "h": 800,
       "sill": 1200
      }
     ],
     "furniture": [],
     "name": "2층"
    }
   ]
  }
 },
 {
  "id": "cat-forest10-y",
  "title": "FOREST10-Y 10평 체류형 쉼터",
  "category": "체류형 쉼터",
  "showroom": "김포 본사전시장",
  "tags": [
   "카탈로그도면",
   "FOREST10-Y",
   "10평 체류형 쉼터"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/forest10-y/1790757161289_fsbnhc.webp?width=640&height=480&resize=cover&quality=70",
  "code": "FOREST10-Y",
  "catSlugs": [
   "forest10-y"
  ],
  "source": "catalog-cad",
  "confidence": "medium",
  "base": {
   "name": "FOREST10-Y 10평 체류형 쉼터",
   "productType": "체류형 쉼터",
   "ceilingHeight": 2400,
   "foundationHeight": 150,
   "wallThickness": 100,
   "exterior": {
    "material": "metal",
    "color": "#d8b24a",
    "dir": "v"
   },
   "roof": {
    "type": "flat",
    "color": "#d8b24a"
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "bed",
     "type": "bedroom",
     "name": "방",
     "x": 0,
     "y": 0,
     "w": 2660,
     "d": 3000
    },
    {
     "key": "bath",
     "type": "bath",
     "name": "화장실",
     "x": 2660,
     "y": 0,
     "w": 2620,
     "d": 1560
    },
    {
     "key": "ent",
     "type": "entrance",
     "name": "현관",
     "x": 2660,
     "y": 1560,
     "w": 2620,
     "d": 1440,
     "open": [
      "e"
     ]
    },
    {
     "key": "liv",
     "type": "living",
     "name": "거실/주방",
     "x": 5280,
     "y": 0,
     "w": 5720,
     "d": 3000,
     "open": [
      "w"
     ]
    }
   ],
   "openings": [
    {
     "roomKey": "bed",
     "side": "w",
     "pos": 1500,
     "winType": "double",
     "w": 1500,
     "h": 900,
     "sill": 1100
    },
    {
     "roomKey": "bed",
     "side": "s",
     "pos": 1350,
     "winType": "fixed",
     "w": 1800,
     "h": 800,
     "sill": 1200
    },
    {
     "roomKey": "bed",
     "side": "e",
     "pos": 2450,
     "winType": "swingDoor",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "bath",
     "side": "n",
     "pos": 1040,
     "winType": "double",
     "w": 600,
     "h": 500,
     "sill": 1500
    },
    {
     "roomKey": "bath",
     "side": "s",
     "pos": 410,
     "winType": "swingDoor",
     "w": 700,
     "h": 2000,
     "sill": 0
    },
    {
     "roomKey": "ent",
     "side": "s",
     "pos": 510,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "liv",
     "side": "n",
     "pos": 2070,
     "winType": "double",
     "w": 1500,
     "h": 700,
     "sill": 1050
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 1000,
     "winType": "fixed",
     "w": 2000,
     "h": 800,
     "sill": 1200
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 3620,
     "winType": "balcony",
     "w": 2000,
     "h": 2100,
     "sill": 100
    },
    {
     "roomKey": "liv",
     "side": "e",
     "pos": 1500,
     "winType": "double",
     "w": 2000,
     "h": 1200,
     "sill": 800
    }
   ],
   "furniture": [
    {
     "catalogId": "basin",
     "x": 3070,
     "y": 350,
     "rotation": 0
    },
    {
     "catalogId": "toilet",
     "x": 3750,
     "y": 450,
     "rotation": 0
    },
    {
     "catalogId": "washer",
     "x": 4900,
     "y": 450,
     "rotation": 0
    },
    {
     "catalogId": "fridge",
     "x": 5790,
     "y": 500,
     "rotation": 0
    },
    {
     "catalogId": "sink",
     "x": 7440,
     "y": 400,
     "rotation": 0
    },
    {
     "catalogId": "sofa3",
     "x": 9780,
     "y": 580,
     "rotation": 0
    }
   ]
  }
 },
 {
  "id": "cat-cube-h4-o",
  "title": "CUBE-H4-O 4평 찜질방",
  "category": "특별모델",
  "showroom": "김포 본사전시장",
  "tags": [
   "카탈로그도면",
   "CUBE-H4-O",
   "4평 찜질방"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/cube-h4o/1782956768047_cobotx.png?width=640&height=480&resize=cover&quality=70",
  "code": "CUBE-H4-O",
  "catSlugs": [
   "cube-h4o"
  ],
  "source": "catalog-cad",
  "confidence": "medium",
  "base": {
   "name": "CUBE-H4-O 4평 찜질방",
   "productType": "농막",
   "ceilingHeight": 2400,
   "foundationHeight": 200,
   "wallThickness": 200,
   "exterior": {
    "material": "ceramic",
    "color": "#c08f5a",
    "corner": "#2f3237"
   },
   "roof": {
    "type": "shed",
    "color": "#3a3f44",
    "rise": 300
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "room",
     "type": "room",
     "name": "찜질방",
     "x": 0,
     "y": 0,
     "w": 3200,
     "d": 4200
    },
    {
     "key": "porch",
     "type": "porch",
     "name": "포치",
     "x": 0,
     "y": 4200,
     "w": 3200,
     "d": 1800,
     "rail": [
      "e",
      "w"
     ]
    }
   ],
   "openings": [
    {
     "roomKey": "room",
     "side": "w",
     "pos": 2100,
     "winType": "double",
     "w": 1400,
     "h": 800,
     "sill": 1300
    },
    {
     "roomKey": "room",
     "side": "e",
     "pos": 2100,
     "winType": "double",
     "w": 1400,
     "h": 800,
     "sill": 1300
    },
    {
     "roomKey": "room",
     "side": "s",
     "pos": 1600,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    }
   ],
   "furniture": []
  }
 },
 {
  "id": "cat-forest8-y",
  "title": "FOREST8-Y 8평 체류형쉼터",
  "category": "체류형 쉼터",
  "showroom": "김포 제1전시장",
  "tags": [
   "카탈로그도면",
   "FOREST8-Y",
   "8평 체류형쉼터"
  ],
  "photo": "https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/model-images/forest8-o/1790836592089_l0whkh.webp?width=640&height=480&resize=cover&quality=70",
  "code": "FOREST8-Y",
  "catSlugs": [
   "forest8-o"
  ],
  "source": "catalog-cad",
  "confidence": "high",
  "base": {
   "name": "FOREST-8-Y 8평 체류형쉼터",
   "productType": "체류형 쉼터",
   "ceilingHeight": 2400,
   "foundationHeight": 150,
   "wallThickness": 200,
   "exterior": {
    "material": "metalV",
    "color": "#b8773e",
    "dir": "v",
    "corner": "#2f3237"
   },
   "roof": {
    "type": "gable",
    "color": "#3a3f44",
    "ridge": "x",
    "rise": 600
   },
   "wallThicknessInt": 120,
   "rooms": [
    {
     "key": "liv",
     "type": "living",
     "name": "거실",
     "x": 0,
     "y": 0,
     "w": 5940,
     "d": 3200,
     "open": [
      "e"
     ]
    },
    {
     "key": "bath",
     "type": "bath",
     "name": "화장실",
     "x": 5940,
     "y": 0,
     "w": 2260,
     "d": 1460
    },
    {
     "key": "kit",
     "type": "kitchen",
     "name": "주방",
     "x": 5940,
     "y": 1460,
     "w": 2260,
     "d": 1740,
     "open": [
      "w"
     ]
    }
   ],
   "openings": [
    {
     "roomKey": "liv",
     "side": "n",
     "pos": 2940,
     "winType": "double",
     "w": 1000,
     "h": 900,
     "sill": 1100
    },
    {
     "roomKey": "liv",
     "side": "w",
     "pos": 1600,
     "winType": "fixed",
     "w": 1000,
     "h": 600,
     "sill": 1500
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 2200,
     "winType": "balcony",
     "w": 2000,
     "h": 2100,
     "sill": 120
    },
    {
     "roomKey": "liv",
     "side": "s",
     "pos": 5150,
     "winType": "door",
     "w": 900,
     "h": 2100,
     "sill": 0
    },
    {
     "roomKey": "kit",
     "side": "s",
     "pos": 1210,
     "winType": "double",
     "w": 1000,
     "h": 300,
     "sill": 1100
    },
    {
     "roomKey": "bath",
     "side": "e",
     "pos": 850,
     "winType": "double",
     "w": 600,
     "h": 500,
     "sill": 1500
    },
    {
     "roomKey": "bath",
     "side": "s",
     "pos": 480,
     "winType": "swingDoor",
     "w": 700,
     "h": 1900,
     "sill": 0
    }
   ],
   "furniture": [
    {
     "catalogId": "toilet",
     "x": 6500,
     "y": 550,
     "rotation": 0
    },
    {
     "catalogId": "basin",
     "x": 7140,
     "y": 420,
     "rotation": 0
    },
    {
     "catalogId": "induction2",
     "x": 7620,
     "y": 1880,
     "rotation": 90
    },
    {
     "catalogId": "sink18",
     "x": 7100,
     "y": 2700,
     "rotation": 180
    }
   ]
  }
 }
];
