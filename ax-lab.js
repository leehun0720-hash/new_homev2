/* The three AX routes are an exploratory guide, not a personalized assessment. */
const paths = {
  learn: {
    parts: ['AI 교육', '바이브코딩', '핸드북'],
    tag: 'YOUR NEXT MOVE / 01',
    title: '팀의 AI 근육부터 만듭니다.',
    description: '직무에 맞춘 실무 교육과 바이브코딩으로, 배운 내용을 바로 업무에 적용하는 첫 경험을 설계합니다.',
    href: '/education',
    link: 'AI 교육 살펴보기 ↗',
  },
  plan: {
    parts: ['업무 진단', 'AX 전략', 'AIDC 자문'],
    tag: 'YOUR NEXT MOVE / 02',
    title: '변화의 경로부터 그립니다.',
    description: '조직의 업무와 데이터를 살펴 AI 적용 순서를 정하고, 필요한 인프라와 운영 방식을 설계합니다.',
    href: '/business',
    link: '사업 영역 살펴보기 ↗',
  },
  build: {
    parts: ['TenOS', 'RAG 구축', 'AX 플랫폼'],
    tag: 'YOUR NEXT MOVE / 03',
    title: '현장에서 작동하는 AI를 만듭니다.',
    description: '한국어 모델과 내부 지식을 연결해, 조직이 직접 사용할 수 있는 AI 시스템과 플랫폼을 구축합니다.',
    href: '/apps',
    link: '쇼케이스 살펴보기 ↗',
  },
};

const choices = [...document.querySelectorAll('[data-ax-choice]')];
const output = document.getElementById('axOutput');

if (output && choices.length) {
  choices.forEach((button, index) => {
    button.addEventListener('click', () => {
      const path = paths[button.dataset.axChoice];
      if (!path) return;

      choices.forEach(choice => {
        const selected = choice === button;
        choice.classList.toggle('active', selected);
        choice.setAttribute('aria-pressed', String(selected));
      });

      path.parts.forEach((part, partIndex) => {
        document.getElementById(`axPiece${partIndex + 1}`).textContent = part;
      });
      document.getElementById('axStatus').textContent = `PATH 0${index + 1} ACTIVE`;
      document.getElementById('axResultTag').textContent = path.tag;
      document.getElementById('axResultTitle').textContent = path.title;
      document.getElementById('axResultDescription').textContent = path.description;
      const link = document.getElementById('axResultLink');
      link.href = path.href;
      link.textContent = path.link;
      output.classList.toggle('changed');
    });
  });
}
