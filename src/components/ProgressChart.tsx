import React from 'react';

interface ChartDataItem {
  date: string;
  quizCount: number;
  avgScore: number;
}

interface ProgressChartProps {
  data: ChartDataItem[];
}

const ProgressChart: React.FC<ProgressChartProps> = ({ data }) => {
  const maxScore = 100;
  const maxQuizCount = Math.max(...data.map(d => d.quizCount), 5);

  return (
    <div style={{ width: '100%' }}>
      {/* Grafik Alanı */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'flex-end', 
        gap: '10px', 
        height: '200px',
        padding: '20px 0',
        borderBottom: '2px solid var(--border-color)'
      }}>
        {data.map((item, index) => (
          <div 
            key={index}
            style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              gap: '5px'
            }}
          >
            {/* Skor Çubuğu */}
            <div 
              style={{
                width: '100%',
                maxWidth: '40px',
                height: `${(item.avgScore / maxScore) * 150}px`,
                minHeight: item.quizCount > 0 ? '20px' : '0px',
                background: item.avgScore >= 70 
                  ? 'linear-gradient(180deg, var(--success-color), #34d399)'
                  : item.avgScore >= 50 
                    ? 'linear-gradient(180deg, var(--warning-color), #fbbf24)'
                    : item.quizCount > 0 
                      ? 'linear-gradient(180deg, var(--danger-color), #f87171)'
                      : 'var(--border-color)',
                borderRadius: '6px 6px 0 0',
                transition: 'height 0.3s ease',
                position: 'relative',
              }}
            >
              {item.quizCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-25px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  color: 'var(--text-primary)',
                }}>
                  %{item.avgScore}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* X Ekseni - Günler */}
      <div style={{ 
        display: 'flex', 
        gap: '10px',
        paddingTop: '10px'
      }}>
        {data.map((item, index) => (
          <div 
            key={index}
            style={{ 
              flex: 1, 
              textAlign: 'center',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)'
            }}
          >
            <div>{item.date}</div>
            <div style={{ 
              fontSize: '0.7rem', 
              color: item.quizCount > 0 ? 'var(--primary-color)' : 'var(--text-secondary)' 
            }}>
              {item.quizCount} quiz
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '20px', 
        marginTop: '20px',
        fontSize: '0.8rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '12px', height: '12px', background: 'var(--success-color)', borderRadius: '3px' }} />
          <span>%70+</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '12px', height: '12px', background: 'var(--warning-color)', borderRadius: '3px' }} />
          <span>%50-69</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '12px', height: '12px', background: 'var(--danger-color)', borderRadius: '3px' }} />
          <span>%50 altı</span>
        </div>
      </div>
    </div>
  );
};

export default ProgressChart;