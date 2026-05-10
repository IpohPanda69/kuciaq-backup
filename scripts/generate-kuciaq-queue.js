#!/usr/bin/env node
// Generate 7 days of kuciaq content - 10 posts/day (7 affiliate + 3 value)
// Persona: Kucing (no gender), santai & kelakar, kontroversial, BM KL
// Chain posts: 15-45 min delay between parts

const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, '../data/queue/kuciaq-warmup.json');
const LINKS_FILE = path.join(__dirname, '../config/kuciaq-affiliate-links.json');

const links = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8')).links;

// Helper: shuffle array
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// AFFILIATE POSTS - High hook, controversial, FOMO, fear-mongering
// Each post matched to a product
// ============================================================

const affiliatePosts = [
  // ===== CHAIN 1: Dental Care (3 parts) =====
  {
    productId: 'k-aff-001',
    type: 'chain',
    hookStyle: 'fear',
    parts: [
      "korang tahu tak 80% kucing ada masalah gigi sebelum 3 tahun. 80 PERATUS. dan most owner tak sedar langsung sebab kucing memang pandai cover pain. dia still makan still minum tapi dalam hati dah sakit weh",
      "aku dulu pun tak tahu. ingat kucing aku jenis slow makan rupanya gusi dia bengkak. vet cakap kalau lambat lagi boleh infection spread ke jantung. 30 saat je titis water additive ni dalam air. done https://s.shopee.com.my/60NzIPCeqd",
      "benda ni bukan magic tapi prevent. compare dengan kos cabut gigi RM500++ kat vet. 1 botol RM40 lebih boleh pakai 2 bulan. buat math sendiri. better spend 67 sen sehari dari RM500 sekali harung"
    ]
  },

  // ===== SINGLE: XXL Cage =====
  {
    productId: 'k-aff-002',
    type: 'single',
    hookStyle: 'controversial',
    text: "hot take: kalau korang bela kucing tapi tak bagi dia space sendiri tu macam korang duduk dalam studio apartment 200sqft seumur hidup. kucing perlukan territory. XXL cage besar ni bukan untuk kurung tapi untuk bagi dia safe zone. ada tempat retreat bila dia overwhelmed https://s.shopee.com.my/7ppdTrdxMG"
  },

  // ===== CHAIN 2: Royal Canin Indoor (3 parts) =====
  {
    productId: 'k-aff-003',
    type: 'chain',
    hookStyle: 'fear',
    parts: [
      "warning keras. kucing indoor yang makan brand murah tinggi magnesium boleh kena KIDNEY FAILURE. aku tak scaremongering. vet sendiri cakap ni salah satu punca utama kidney disease dalam indoor cats. please baca ingredient food korang",
      "aku switch ke Royal Canin Indoor 27 lepas vet warning ni. formula ni memang specific untuk indoor cats yang kurang active. controlled mineral content. high protein. 4kg pack. bukan murah tapi compare dengan dialysis RM3k sekali...",
      "tengok perbezaan dalam 2 minggu. kucing makan lebih laju. bulu makin thick. energy level up. vet pun kata condition better. aku bukan brand ambassador Royal Canin tapi benda ni betul betul works untuk kucing aku https://s.shopee.com.my/9AL14Mc4Ij"
    ]
  },

  // ===== SINGLE: Smart Feeder =====
  {
    productId: 'k-aff-004',
    type: 'single',
    hookStyle: 'fomo',
    text: "korang yang kerja 9-6 setiap hari pernah tak terfikir kucing korang lapar berapa jam sebelum korang balik? 8 jam minimum. 8 JAM. smart feeder ni solve the problem completely. schedule 4-5 feeding per day. 4L capacity tahan 2 hari. app notification. boleh nampak kucing makan real time. peace of mind tu priceless https://s.shopee.com.my/5AosJ5BogD"
  },

  // ===== SINGLE: Ear Cleaner =====
  {
    productId: 'k-aff-005',
    type: 'single',
    hookStyle: 'educational-fear',
    text: "korang pernah check telinga kucing korang lately? kalau selalu garu telinga goyang kepala atau ada bau pelik tu tanda ear mites atau infection. jangan ignore. ear infection yang tak treated boleh jadi permanent hearing loss. cleaner ni 150ml. 3 minit je treatment. titis urut lap. done https://s.shopee.com.my/1gF08g0xXk"
  },

  // ===== SINGLE: Foldable Tent =====
  {
    productId: 'k-aff-006',
    type: 'single',
    hookStyle: 'lifestyle',
    text: "kucing korang jenis suka outdoor tapi korang takut lepaskan sebab kawasan banyak kereta atau anjing liar? tent portable ni perfect compromise. kucing dapat experience outdoor feel fresh air sunshine tapi dalam controlled environment. foldable mudah bawa camping atau picnic https://s.shopee.com.my/5q4Z6MSgrG"
  },

  // ===== CHAIN 3: Hair & Skin Food (2 parts) =====
  {
    productId: 'k-aff-007',
    type: 'chain',
    hookStyle: 'problem-solution',
    parts: [
      "korang notice tak bulu kucing korang makin nipis atau kulit banyak flakes. tu BUKAN normal shedding. tu tanda nutritional deficiency. kulit dan bulu adalah indicator pertama kesihatan kucing. kalau nampak change macam tu something wrong",
      "Royal Canin Hair & Skin formula ni ada Omega 3 dan 6 yang specifically targeted untuk bulu dan kulit. 2kg pack. try sebulan. kalau tak nampak beza bulu lagi shiny dan kulit less flakes aku tak tahu nak cakap apa lagi https://s.shopee.com.my/6fdg5v2EKM"
    ]
  },

  // ===== SINGLE: Vitamin =====
  {
    productId: 'k-aff-008',
    type: 'single',
    hookStyle: 'educational',
    text: "fakta yang most cat owner tak tahu: kucing indoor tak dapat nutrients yang diaorang dapat dari hunting dalam nature. tu kenapa supplement penting. MEOWLAB vitamin ni 12 sachet sebulan. just mix dalam food atau air. result in 2 weeks bulu shinier energy level up immunity better https://s.shopee.com.my/2g7XKauVuu"
  },

  // ===== SINGLE: Bulk Cat Food =====
  {
    productId: 'k-aff-009',
    type: 'single',
    hookStyle: 'money-saving',
    text: "math untuk yang bela lebih dari 1 kucing. beli food 18kg vs beli pack kecil 2kg x 9. 18kg jauh lagi murah per kg. Belif chicken & turkey formula ni high protein cats suka gila. 1 pack besar boleh tahan 1-2 bulan depending on how many cats. bulk buy = smart buy https://s.shopee.com.my/20rqXQiEkJ"
  },

  // ===== SINGLE: Mid-range Cat Food =====
  {
    productId: 'k-aff-010',
    type: 'single',
    hookStyle: 'budget-friendly',
    text: "yang bajet limited tapi still nak bagi kucing nutrition decent LGD PETS chicken tuna with milk ni good option. 10kg RM100++. Tak semahal premium brand tapi still jauh better dari generic brand pasaraya yang mostly filler dan by-products. cats suka rasa milk tu https://s.shopee.com.my/901asJuv3u"
  },

  // ===== SINGLE: Dental Care (different angle) =====
  {
    productId: 'k-aff-001',
    type: 'single',
    hookStyle: 'science',
    text: "study dari Journal of Veterinary Dentistry found that cats with periodontal disease have 3x higher risk of heart disease. 3X. bau mulut bukan just annoying tu sign of bacteria buildup. water additive ni kill bacteria without brushing. pour and forget https://s.shopee.com.my/60NzIPCeqd"
  },

  // ===== CHAIN 4: Smart Feeder (experience-based) =====
  {
    productId: 'k-aff-004',
    type: 'chain',
    hookStyle: 'story',
    parts: [
      "aku pernah balik rumah jumpa kucing muntah sebab lapar sangat. dia makan terlalu cepat sebab dah tunggu 10 jam tanpa food. lepas tu aku decide cukup la rasa bersalah setiap hari keluar kerja",
      "smart feeder ni change my life literally. aku set 4 feeding time: 7am 12pm 5pm 10pm. kucing dapat consistent meals. no more vomiting from eating too fast. no more meowing at 3am minta food. app bagi notification bila makanan tinggal sikit",
      "4L capacity. portion control. timer. app control. semua dalam 1 device. kucing aku lebih happy dan aku lebih tenang. worth every single sen https://s.shopee.com.my/5AosJ5BogD"
    ]
  },

  // ===== SINGLE: Cage (different angle) =====
  {
    productId: 'k-aff-002',
    type: 'single',
    hookStyle: 'myth-busting',
    text: "myth: sangkar ni cruel untuk kucing. fact: cats in the wild seek out enclosed spaces for safety. den caves small spaces. sangkar besar ni give them that same feeling. bukan kurung 24/7 tapi bagi dia place of comfort. macam korang ada favorite corner dalam rumah https://s.shopee.com.my/7ppdTrdxMG"
  },

  // ===== SINGLE: Ear Cleaner (different angle) =====
  {
    productId: 'k-aff-005',
    type: 'single',
    hookStyle: 'tip',
    text: "pro tip: check telinga kucing once a week. healthy ear = light pink dan clean. kalau nampak dark brown discharge atau bau pelik tu problem. ear cleaner ni gentle formula. tak pedih. kucing pun tak struggle. titis 3-4 drops urut base of ear lap dengan tissue. 2 minit je https://s.shopee.com.my/1gF08g0xXk"
  },

  // ===== SINGLE: Vitamin (different angle) =====
  {
    productId: 'k-aff-008',
    type: 'single',
    hookStyle: 'comparison',
    text: "korang tahu tak perbezaan antara kucing yang dapat supplement dan yang tak. bukan just bulu lagi cantik. immunity better. less sick. less vet visits. less stress untuk korang. vitamin ni 12 sachet sebulan. RM3 per day. compare dengan vet visit RM150 minimum. do the math https://s.shopee.com.my/2g7XKauVuu"
  },

  // ===== CHAIN 5: Royal Canin Hair & Skin (2 parts) =====
  {
    productId: 'k-aff-007',
    type: 'chain',
    hookStyle: 'before-after',
    parts: [
      "before: kucing aku bulu kusam kulit berkecam. aku ingat normal. rupanya bukan. after 3 weeks tukar ke Royal Canin Hair & Skin: bulu lembut shiny kulit dah tak flakes. aku rasa macam baru dapat kucing lain",
      "formula ni memang targeted untuk bulu dan kulit. Omega 3 & 6. zinc. semua nutrients yang kulit dan bulu perlukan. 2kg pack. try 1 month. kalau tak nampak beza seriously aku tak tahu https://s.shopee.com.my/6fdg5v2EKM"
    ]
  },

  // ===== SINGLE: Bulk Food (different angle) =====
  {
    productId: 'k-aff-009',
    type: 'single',
    hookStyle: 'tip',
    text: "tips jimat untuk multi-cat household: beli 18kg bulk. store dalam airtight container. jangan biar bag terbuka sebab food boleh oxidize dan lose nutrients. Belif chicken & turkey ni cats suka. high protein. no artificial colors. good quality at bulk price https://s.shopee.com.my/20rqXQiEkJ"
  },

  // ===== SINGLE: Mid-range Food (different angle) =====
  {
    productId: 'k-aff-010',
    type: 'single',
    hookStyle: 'honest-review',
    text: "honest review LGD PETS 10kg. pros: harga berpatutan cats suka rasa milk tu packaging ok. cons: not as high protein as premium brands. verdict: good untuk yang on budget. better dari pasaraya brand tapi kalau boleh afford premium lagi better. no shame in budget feeding https://s.shopee.com.my/901asJuv3u"
  },

  // ===== CHAIN 6: Foldable Tent (2 parts) =====
  {
    productId: 'k-aff-006',
    type: 'chain',
    hookStyle: 'lifestyle',
    parts: [
      "korang pernah nampak kucing korang duduk kat tingkap tengok luar dengan muka sedih. dia nak outdoor tapi korang risau. aku pun sama. so aku cari solution yang bagi dia outdoor experience tanpa risk",
      "foldable tent ni jawapannya. kucing dapat feel grass fresh air sunshine tapi dalam safe enclosed space. portable. lipat kecil boleh bawa picnic. kucing happy owner tenang. win-win https://s.shopee.com.my/5q4Z6MSgrG"
    ]
  },

  // ===== SINGLE: Dental Care (tip angle) =====
  {
    productId: 'k-aff-001',
    type: 'single',
    hookStyle: 'tip',
    text: "cara check gigi kucing: angkat bibir atas. gusi should be pink bukan merah atau bengkak. gigi bersih bukan kuning atau ada tartar. kalau nampak problem jangan wait. water additive ni easy prevention. pour in water bowl. bacteria fight while they drink. zero effort https://s.shopee.com.my/60NzIPCeqd"
  }
];

// ============================================================
// VALUE POSTS - No links, viral potential, cat facts, funny
// ============================================================

const valuePosts = [
  {
    text: "tahu tak kenapa kucing suka tidur atas laptop korang. bukan sebab nak ganggu korang kerja tapi sebab laptop warm dan ada bau owner. kucing associate bau korang dengan safety. lagi dia trust korang lagi dia nak dekat dengan barang korang. jangan halau ye let him cook 😻"
  },
  {
    text: "kenapa kucing suka baring atas belakang korang masa tidur. satu body heat. dua dia protect korang in his mind. tiga korang tak gerak masa tidur so dia rasa safe. empat dia claim territory. kalau korang ada kucing yang buat ni congrats dia betul betul sayang korang ❤️"
  },
  {
    text: "fakta kucing yang orang tak tahu: kucing boleh rotate telinga 180 degrees sebab ada 32 muscles dalam setiap telinga. manusia ada 6 je. tu yang dia boleh dengar korang buka fridge dari bilik tidur even dalam deep sleep. evolution made them perfect hunters 🐾"
  },
  {
    text: "korang tahu tak kucing boleh jump 6 kali height dia. kalau korang tinggi 170cm kucing boleh lompat lebih 1 meter. tu yang dia boleh sampai atas fridge easily. tapi kalau korang ada kucing tua atau overweight jumping ability will decline. monitor his weight okay 🐱"
  },
  {
    text: "kenapa kucing suka push barang dari meja. bukan sebab dia jahat tapi sebab dia bored atau nak attention. dalam nature cats explore dengan paw. pushing things teach them about objects. kalau selalu buat tu bagi toys lebih atau spend quality time 🎮"
  },
  {
    text: "kucing tidur 12-16 jam sehari bukan sebab malas tapi sebab dalam nature mereka perlu conserve energy untuk hunting. even though domestic cats tak perlu hunt anymore instinct still ada. so kalau korang nampak kucing tidur sepanjang hari don't worry dia normal 😴"
  },
  {
    text: "korang pernah notice kucing selalu jilat bulu lepas makan. tu grooming instinct. dalam wild scent dari food boleh attract predators. so they clean themselves to remove the smell. even though kucing korang duduk dalam rumah pun instinct tu still there. evolution baby 🐾"
  },
  {
    text: "kenapa kucing suka duduk dalam box kecil. confined spaces buat diaorang rasa safe and secure. dalam nature small spaces protect dari predators dan allow cats to ambush prey. tu yang even though korang beli bed RM100 dia still prefer box Amazon je 😂"
  },
  {
    text: "kucing purr bukan just bila happy. diaorang purr jugak bila sakit atau stressed sebab purring frequency (25-150 Hz) actually promote healing dan bone growth. self healing mechanism. cats literally vibrate to feel better. science is amazing 🔬"
  },
  {
    text: "korang tahu tak kucing boleh recognize nama sendiri tapi diaorang pilih untuk ignore. study di Japan prove cats respond to their names tapi macam tak peduli. bukan sebab dia tak dengar tapi sebab dia decide taknak respond. cats be cats 🐱"
  },
  {
    text: "kenapa kucing selalu menggosok kepala kat kaki korang. tu cara dia mark territory dengan scent glands yang ada kat kepala. basically dia cakap this human is MINE. jangan orang lain sentuh. kalau korang ada kucing yang buat ni you've been claimed 😌"
  },
  {
    text: "kucing ada third eyelid called nictitating membrane. function dia protect mata dari dust dan injury. kalau korang nampak third eyelid tu always showing mungkin kucing korang sakit atau dehydrated. check with vet okay 🐾"
  },
  {
    text: "fun fact: kucing boleh lari 48km/j. lebih laju dari Usain Bolt. tu yang dia boleh zoom around rumah 3am macam ada orang kejar. dalam nature speed ni untuk catch prey. dalam apartment ni untuk destroy barang korang 😂"
  },
  {
    text: "kenapa kucing suka main dengan barang kecil macam getah gelang atau paper clip. sebab size tu similar dengan prey size dalam nature. mouse insects birds kecil. main dengan barang kecil tu practice hunting instinct. bagi toys yang similar size untuk satisfy dia 🐭"
  },
  {
    text: "kucing ada whiskers bukan untuk cantik je. whiskers tu sensory organs yang detect air currents dan help them navigate in dark. jangan ever potong whiskers kucing. tu macam butakan dia. whiskers adalah superpower dia 🐱"
  },
  {
    text: "korang tahu tak setiap kucing ada nose print yang unique. macam fingerprint manusia. tak ada dua kucing yang sama nose print. so technically korang boleh identify kucing korang dari hidung je. tapi good luck nak scan hidung kucing yang taknak diam 😂"
  },
  {
    text: "kenapa kucing suka tidur dalam positions pelik macam terbalik atau legs straight up. tu tanda dia rasa 100% safe. dalam nature cats tidur curled up untuk protect vital organs. kalau dia tidur expose perut tu means dia trust korang completely. that's love 🥰"
  },
  {
    text: "kucing boleh dengar frequencies up to 64kHz. manusia hanya 20kHz. tu yang dia boleh dengar bunyi yang kita tak boleh dengar. termasuk bunyi tikus dalam dinding dan korang buka food package dari bilik lain. nothing escapes those ears 🐾"
  },
  {
    text: "kenapa kucing always pilih duduk atas baju korang yang baru basuh. sebab baju korang ada bau paling strong. dia suka bau owner. tu comfort dia. also baju bersih warm dari dryer. double comfort. kalau korang nampak kucing duduk atas baju korang tu dia rindu korang actually ❤️"
  },
  {
    text: "fun fact: kucing spend 30-50% of their waking hours grooming. tu more time dari any other animal. grooming bukan just untuk clean tapi jugak untuk regulate body temperature dan spread natural oils pada bulu._cats are basically self-cleaning machines 🧹"
  }
];

// ============================================================
// GENERATE 7 DAYS OF CONTENT
// Pattern: A V A A V A A V A A (7 affiliate + 3 value = 10/day)
// ============================================================

function generateQueue() {
  const queue = [];
  let postId = 1;
  const today = new Date();

  // Shuffle to get variety but keep enough for 7 days
  const shuffledAffiliate = shuffle(affiliatePosts);
  const shuffledValue = shuffle(valuePosts);

  // Ensure we have enough content for 7 days (70 posts, 49 affiliate, 21 value)
  // Duplicate and shuffle if needed
  while (shuffledAffiliate.length < 49) {
    shuffledAffiliate.push(...shuffle(affiliatePosts));
  }
  while (shuffledValue.length < 21) {
    shuffledValue.push(...shuffle(valuePosts));
  }

  let affIdx = 0;
  let valIdx = 0;

  for (let day = 0; day < 7; day++) {
    const currentDate = new Date(today);
    currentDate.setDate(currentDate.getDate() + day);
    const dateStr = currentDate.toISOString().split('T')[0];

    // 10 time slots per day (8 AM - 9:30 PM MYT = 00:00 - 13:30 UTC)
    // Each slot ~1.5 hours apart
    const timeSlotsMYT = [
      [8, 0],    // 8:00 AM
      [9, 30],   // 9:30 AM
      [11, 0],   // 11:00 AM
      [12, 30],  // 12:30 PM
      [14, 0],   // 2:00 PM
      [15, 30],  // 3:30 PM
      [17, 0],   // 5:00 PM
      [18, 30],  // 6:30 PM
      [20, 0],   // 8:00 PM
      [21, 30],  // 9:30 PM
    ];

    // Pattern: A V A A V A A V A A
    const pattern = ['A', 'V', 'A', 'A', 'V', 'A', 'A', 'V', 'A', 'A'];

    for (let i = 0; i < 10; i++) {
      const isAffiliate = pattern[i] === 'A';
      const [hMYT, mMYT] = timeSlotsMYT[i];
      const hUTC = hMYT - 8;
      const mUTC = mMYT;
      const scheduledUTC = `${dateStr}T${String(hUTC).padStart(2, '0')}:${String(mUTC).padStart(2, '0')}:00Z`;
      const slot = hMYT < 12 ? 'morning' : 'night';

      if (isAffiliate) {
        const post = shuffledAffiliate[affIdx % shuffledAffiliate.length];
        affIdx++;

        if (post.type === 'chain') {
          queue.push({
            id: `kuciaq-${String(postId).padStart(3, '0')}`,
            date: dateStr,
            slot,
            scheduled_utc: scheduledUTC,
            text: post.parts[0],
            pillar: 'affiliate-chain',
            status: 'pending',
            thread_id: null,
            thread_parts: post.parts,
            thread_count: post.parts.length,
            posted_at: null,
            strategy: {
              contentType: 'affiliate-chain',
              topicWindow: slot === 'morning' ? 'work-start' : 'evening-peak',
              ratioModel: '7-affiliate-3-value',
              chainDelayMin: 15,
              chainDelayMax: 45
            },
            affiliateLink: links.find(l => l.id === post.productId)?.shortLink || null,
            productId: post.productId,
            hookStyle: post.hookStyle
          });
        } else {
          queue.push({
            id: `kuciaq-${String(postId).padStart(3, '0')}`,
            date: dateStr,
            slot,
            scheduled_utc: scheduledUTC,
            text: post.text,
            pillar: 'affiliate-single',
            status: 'pending',
            thread_id: null,
            posted_at: null,
            strategy: {
              contentType: 'affiliate',
              topicWindow: slot === 'morning' ? 'work-start' : 'evening-peak',
              ratioModel: '7-affiliate-3-value'
            },
            affiliateLink: links.find(l => l.id === post.productId)?.shortLink || null,
            productId: post.productId,
            hookStyle: post.hookStyle
          });
        }
      } else {
        const post = shuffledValue[valIdx % shuffledValue.length];
        valIdx++;

        queue.push({
          id: `kuciaq-${String(postId).padStart(3, '0')}`,
          date: dateStr,
          slot,
          scheduled_utc: scheduledUTC,
          text: post.text,
          pillar: 'value-life',
          status: 'pending',
          thread_id: null,
          posted_at: null,
          strategy: {
            contentType: 'value',
            topicWindow: slot === 'morning' ? 'work-start' : 'evening-peak',
            ratioModel: '7-affiliate-3-value'
          },
          affiliateLink: null,
          productId: null,
          hookStyle: 'value'
        });
      }

      postId++;
    }
  }

  return queue;
}

const queue = generateQueue();
fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));

const totalPosts = queue.length;
const affiliatePosts_count = queue.filter(p => p.pillar.includes('affiliate')).length;
const valuePosts_count = queue.filter(p => p.pillar.includes('value')).length;
const chainPosts = queue.filter(p => p.pillar === 'affiliate-chain').length;
const singlePosts = queue.filter(p => p.pillar === 'affiliate-single').length;

console.log(`✅ Generated 7 DAYS of kuciaq content:`);
console.log(`   Total posts: ${totalPosts} (${totalPosts/7} per day)`);
console.log(`   Affiliate posts: ${affiliatePosts_count} (${(affiliatePosts_count/totalPosts*100).toFixed(0)}%)`);
console.log(`     - Single posts: ${singlePosts}`);
console.log(`     - Chain posts: ${chainPosts} (${Math.round(chainPosts * 2.5)} total parts)`);
console.log(`   Value posts: ${valuePosts_count} (${(valuePosts_count/totalPosts*100).toFixed(0)}%)`);
console.log(`   Chain delay: 15-45 minutes between parts`);
console.log(`   Queue file: ${QUEUE_FILE}`);

// Show day 1 schedule
console.log(`\n📅 Day 1 Schedule (MYT):`);
queue.filter(p => p.date === queue[0].date).forEach((p, i) => {
  const utc = new Date(p.scheduled_utc);
  const myt = new Date(utc.getTime() + 8*60*60*1000);
  const timeStr = myt.toISOString().substring(11, 16);
  const type = p.pillar.includes('chain') ? '🔗CHAIN' : p.pillar.includes('affiliate') ? '💰AFF' : '📖VALUE';
  console.log(`   ${timeStr} MYT | ${type} | ${p.text.substring(0, 50)}...`);
});
