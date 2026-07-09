#!/usr/bin/env node
// 파트너 봇 — 상대방 역할을 자동으로 수행해서 혼자 전체 플로우를 테스트할 수 있게 해주는 스크립트.
//
// 사용법:
//   1) 확인된(email_confirm) 봇 계정을 한 번만 생성:
//      SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/partner-bot.mjs create --email bot@test.local --password Test1234!
//
//   2) user A 앱에서 초대코드를 만든 뒤, 봇을 실행해 페어링 + 7개 항목 입력 + (선택) ready까지 자동 진행:
//      node scripts/partner-bot.mjs run --email bot@test.local --password Test1234! --invite ABC123
//      node scripts/partner-bot.mjs run --email bot@test.local --password Test1234! --ready   (이미 페어링된 상태에서 새 갈등 입력만 진행)
//
// SUPABASE_SERVICE_ROLE_KEY는 절대 .env.local이나 커밋되는 파일에 넣지 말 것 — create 커맨드 실행 시에만 임시로 넘긴다.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  const env = {};
  try {
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // .env.local 없으면 process.env만 사용
  }
  return env;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      const key = rest[i].slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith('--')) {
        opts[key] = next;
        i++;
      } else {
        opts[key] = true;
      }
    }
  }
  return { command, opts };
}

const FIELD_ORDER = [
  'trigger_moment',
  'hurt_context',
  'feelings',
  'partner_mind',
  'request',
  'my_reflection',
];

// 필드별 답변 후보 — 트리거 패턴("항상/맨날/일부러 그랬잖아" 등)을 피하고
// 구체적 사실 + 감정 + 실제 멘트를 포함하도록 작성. 재질문이 오면 다음 후보로 넘어간다.
const ANSWERS = {
  trigger_moment: [
    '어제 저녁 8시쯤 카톡으로 이번 주말 약속 얘기하다가, 제가 "그날 야근일 수도 있어"라고 하니까 답장이 갑자기 끊겼어요.',
    '정확히는 어제 저녁 8시 12분쯤, 카톡방에서 주말 약속 얘기하다가 제가 야근 가능성을 말한 직후부터 답장이 없었어요.',
  ],
  hurt_context: [
    '사실 그 전날 밤에 제가 먼저 "이번 주 좀 바빠서 시간 못 낼 것 같아"라고 말했는데, "ㅇㅇ 알겠어"라고만 짧게 답했을 때부터 서운했어요. 이번이 처음이 아니라 지난 2주 동안 비슷한 패턴이 몇 번 반복됐고, 저도 야근 때문에 지쳐 있었어요.',
    '그 전날 밤 "알겠어" 한마디로 끝난 게 시작이었던 것 같아요. 최근 2주 정도 이런 일이 반복됐고, 갈등이 생기면 저는 대화를 시도하는 편인데 상대는 말수가 줄어드는 편이에요.',
  ],
  feelings: [
    '갈등 크기는 6 정도, 속상함은 8 정도예요. 감정은 서운함, 답답함, 외로움이 가까워요.',
    '갈등은 6, 속상함은 8 정도이고, 서운함이랑 외로움, 약간의 불안함도 있었어요.',
  ],
  request: [
    '제가 바라는 건, 다음에 제가 바쁘다고 말할 때 "그래도 잠깐 통화 5분만 하자"처럼 먼저 다가와주는 거예요.',
    '저한테는 바빠도 서로 연결되어 있다는 안정감이 중요한 것 같아요. 그게 채워지면 짧은 연락으로도 충분해요.',
    '구체적으로는, 제가 바쁘다고 하면 그냥 넘기지 말고 "언제쯤 괜찮아?"라고 한 마디만 물어봐줬으면 해요.',
  ],
  partner_mind: [
    '일부러 그런 건 아니라고 생각해요. 그 사람도 서운해서 말을 줄인 것 같아요. 그 순간 상대도 서운함, 지침, 소외감을 느꼈을 것 같아요.',
    '악의는 없었다고 봐요. 상대도 서운함을 표현하는 방식이 조용해지는 거라서요. 아마 서운하고 지쳐 있었을 거예요.',
  ],
  my_reflection: [
    '제가 먼저 "바쁘다"고만 말하고 왜 바쁜지, 언제 시간 낼 수 있는지는 설명 안 한 게 아쉬웠어요.',
    '되돌아보면 저도 짧게 통보하듯 말한 부분이 있어서, 좀 더 자세히 설명했어야 했다는 생각이 들어요.',
  ],
};

const MAX_ATTEMPTS_PER_FIELD = 4;

function answerFor(fieldKey, attempt) {
  const candidates = ANSWERS[fieldKey] ?? ['네, 맞아요.'];
  return candidates[Math.min(attempt, candidates.length - 1)];
}

async function main() {
  const { command, opts } = parseArgs(process.argv.slice(2));
  const fileEnv = loadEnvLocal();
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? fileEnv.EXPO_PUBLIC_SUPABASE_URL;
  const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? fileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !ANON_KEY) {
    console.error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY를 .env.local에서 찾을 수 없어요.');
    process.exit(1);
  }

  if (command === 'create') {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.error('create는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요해요 (일회성으로만 넘기고 저장하지 마세요).');
      process.exit(1);
    }
    if (!opts.email || !opts.password) {
      console.error('사용법: node scripts/partner-bot.mjs create --email bot@test.local --password Test1234!');
      process.exit(1);
    }
    const admin = createClient(SUPABASE_URL, serviceKey);
    const { data, error } = await admin.auth.admin.createUser({
      email: opts.email,
      password: opts.password,
      email_confirm: true,
    });
    if (error) {
      console.error('계정 생성 실패:', error.message);
      process.exit(1);
    }
    console.log(`봇 계정 생성 완료: ${data.user.email} (id: ${data.user.id})`);
    console.log('profiles 트리거가 자동으로 프로필을 만들었을 거예요. 이제 run 커맨드로 사용하세요.');
    return;
  }

  if (command === 'rename') {
    // Windows 콘솔에서 한글 argv가 CP949로 깨져 들어와 프로필 이름이 mojibake로 저장되는
    // 사고가 있었음 — 기본값은 이 파일(UTF-8) 안의 상수를 쓰고, --name은 필요할 때만.
    if (!opts.email || !opts.password) {
      console.error('사용법: node scripts/partner-bot.mjs rename --email bot@test.local --password Test1234! [--name 이름]');
      process.exit(1);
    }
    const supabase = createClient(SUPABASE_URL, ANON_KEY);
    const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
      email: opts.email,
      password: opts.password,
    });
    if (signInError) {
      console.error('로그인 실패:', signInError.message);
      process.exit(1);
    }
    const newName = opts.name ?? process.env.BOT_NAME ?? '연습상대';
    const { error: renameError } = await supabase
      .from('profiles')
      .update({ display_name: newName })
      .eq('id', signIn.user.id);
    if (renameError) {
      console.error('이름 변경 실패:', renameError.message);
      process.exit(1);
    }
    console.log(`프로필 이름을 "${newName}"(으)로 변경했어요.`);
    return;
  }

  if (command !== 'run') {
    console.error('사용법: node scripts/partner-bot.mjs <create|run|rename> [옵션들]');
    process.exit(1);
  }

  if (!opts.email || !opts.password) {
    console.error('사용법: node scripts/partner-bot.mjs run --email bot@test.local --password Test1234! [--invite CODE] [--ready]');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, ANON_KEY);

  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: opts.email,
    password: opts.password,
  });
  if (signInError) {
    console.error('로그인 실패:', signInError.message, '— create 커맨드로 계정을 먼저 만들었는지 확인하세요.');
    process.exit(1);
  }
  const userId = signIn.user.id;
  console.log(`로그인 완료: ${opts.email}`);

  // 1) 페어링 확인 / 초대코드 수락
  let { data: couple } = await supabase
    .from('couples')
    .select('*')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .maybeSingle();

  if (!couple) {
    if (!opts.invite) {
      console.error('아직 커플로 연결되지 않았어요. --invite CODE 옵션으로 초대코드를 넘겨주세요.');
      process.exit(1);
    }
    const { data: coupleId, error: acceptError } = await supabase.rpc('accept_couple_invite', {
      invite_code: String(opts.invite).trim().toUpperCase(),
    });
    if (acceptError) {
      console.error('초대코드 수락 실패:', acceptError.message);
      process.exit(1);
    }
    console.log(`페어링 완료 (couple_id: ${coupleId})`);
    ({ data: couple } = await supabase.from('couples').select('*').eq('id', coupleId).single());
  } else {
    console.log('이미 페어링된 상태 — 초대코드 단계 스킵');
  }

  // 2) 진행 중인 갈등 세션 찾기
  const { data: conflict, error: conflictError } = await supabase
    .from('conflicts')
    .select('*')
    .eq('couple_id', couple.id)
    .neq('status', 'resolved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (conflictError) throw conflictError;
  if (!conflict) {
    console.error('진행 중인 맺음이 없어요 — 상대방(user A) 앱에서 먼저 시작해주세요.');
    process.exit(1);
  }
  console.log(`갈등 세션 발견: ${conflict.id} (status: ${conflict.status})`);

  if (conflict.status === 'waiting_partner') {
    const { error } = await supabase
      .from('conflicts')
      .update({ status: 'both_inputting' })
      .eq('id', conflict.id)
      .eq('status', 'waiting_partner');
    if (error) throw error;
    console.log('상태를 both_inputting으로 전환');
  }

  // 3) 이미 입력된 값 확인 (재실행 시 이어서 진행)
  const { data: existingInput } = await supabase
    .from('conflict_inputs')
    .select('*')
    .eq('conflict_id', conflict.id)
    .eq('user_id', userId)
    .maybeSingle();

  const done = {
    trigger_moment: !!existingInput?.trigger_moment,
    hurt_context: !!existingInput?.context_detail,
    feelings: existingInput?.conflict_scale != null,
    request: !!existingInput?.request_refined,
    partner_mind: !!existingInput?.partner_intention,
    my_reflection: !!existingInput?.my_reflection,
  };

  if (existingInput?.is_complete) {
    console.log('이미 모든 항목 입력이 완료된 상태예요.');
  } else {
    for (const fieldKey of FIELD_ORDER) {
      if (done[fieldKey]) {
        console.log(`[skip] ${fieldKey} — 이미 완료됨`);
        continue;
      }
      console.log(`\n[${fieldKey}] 시작`);
      let res = await askInputGuide(supabase, conflict.id, fieldKey, null);
      console.log(`  AI: ${res.message}`);

      let attempt = 0;
      while (!res.field_complete && !res.all_complete) {
        if (attempt >= MAX_ATTEMPTS_PER_FIELD) {
          throw new Error(
            `[${fieldKey}] ${MAX_ATTEMPTS_PER_FIELD}번 시도해도 완료되지 않았어요. ANSWERS 캔드 답변을 조정해주세요. 마지막 AI 메시지: "${res.message}"`,
          );
        }
        const answer = answerFor(fieldKey, attempt);
        console.log(`  나: ${answer}`);
        res = await askInputGuide(supabase, conflict.id, fieldKey, answer);
        console.log(`  AI: ${res.message}`);
        attempt++;
      }

      if (res.all_complete) {
        console.log('\n모든 항목 입력 완료! (편지 생성이 백그라운드에서 트리거됨)');
        break;
      }
    }
  }

  // 4) 선택: ready 처리 (편지 확인 후 미션 페이퍼로 넘어가고 싶을 때)
  if (opts.ready) {
    const { error: upsertError } = await supabase
      .from('conflict_ready_states')
      .upsert({ conflict_id: conflict.id, user_id: userId });
    if (upsertError) throw upsertError;

    const { data: rows, error: countError } = await supabase
      .from('conflict_ready_states')
      .select('user_id')
      .eq('conflict_id', conflict.id);
    if (countError) throw countError;

    const count = rows?.length ?? 0;
    console.log(`\nready 처리 완료 (${count}/2)`);

    if (count === 1) {
      await supabase.from('conflicts').update({ status: 'waiting_ready' }).eq('id', conflict.id);
    } else if (count >= 2) {
      const { error: missionError } = await supabase.functions.invoke('ai-mission', {
        body: { conflict_id: conflict.id },
      });
      if (missionError) throw missionError;
      console.log('양쪽 모두 ready — 미션 페이퍼 생성 요청 완료');
    }
  }

  console.log('\n봇 실행 완료.');
}

async function askInputGuide(supabase, conflictId, fieldKey, userText) {
  const { data, error } = await supabase.functions.invoke('ai-input', {
    body: { conflict_id: conflictId, field_key: fieldKey, user_text: userText },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

main().catch((e) => {
  console.error('\n오류:', e.message ?? e);
  process.exit(1);
});
