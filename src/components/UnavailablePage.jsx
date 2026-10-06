import { useNavigate } from 'react-router';

export default function UnavailablePage({
  title = '화면을 찾을 수 없습니다.',
  description = '주소를 확인하거나 내 스페이스에서 다시 선택해 주세요.',
}) {
  const navigate = useNavigate();
  return (
    <section className="stack">
      <h1>{title}</h1>
      <p role="alert">{description}</p>
      <button className="secondary-button" onClick={() => navigate('/main')}>
        내 스페이스로 이동
      </button>
    </section>
  );
}
