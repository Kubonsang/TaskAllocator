import * as XLSX from 'xlsx';

/**
 * Parses an uploaded Excel file (e.g. "누적_데이터.xlsx") to extract historical scores
 * and task definitions to seed or update the Supabase Database.
 */

export interface ParsedProfile {
  name: string;
  email: string;
  role: 'Admin' | 'Master' | 'Worker';
  totalScore: number;
}

export interface ParsedTask {
  title: string;
  intensity: number;
  startHour: number;
  endHour: number;
  setId?: string;
  color?: string;
}

export async function parseLegacyExcelData(
  file: File
): Promise<{ profiles: ParsedProfile[]; tasks: ParsedTask[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Parse Profiles sheet (assuming sheet name "직원데이터" or first sheet)
        const profileSheetName = workbook.SheetNames.find(s => s.includes('직원') || s.includes('누적')) || workbook.SheetNames[0];
        const profileSheet = workbook.Sheets[profileSheetName];
        
        // Convert to JSON and map to typed objects
        const rawProfiles: any[] = XLSX.utils.sheet_to_json(profileSheet);
        const profiles: ParsedProfile[] = rawProfiles.map((row) => ({
          name: row['이름'] || row['Name'] || '알수없음',
          email: row['이메일'] || row['Email'] || `${row['이름']}@autoassigner.com`,
          role: row['권한'] || row['Role'] || 'Worker',
          totalScore: parseFloat(row['누적점수'] || row['Score'] || '0.0'),
        }));

        // Parse Tasks sheet (assuming sheet name "업무데이터" or second sheet)
        let tasks: ParsedTask[] = [];
        if (workbook.SheetNames.length > 1) {
          const taskSheetName = workbook.SheetNames.find(s => s.includes('업무')) || workbook.SheetNames[1];
          const taskSheet = workbook.Sheets[taskSheetName];
          const rawTasks: any[] = XLSX.utils.sheet_to_json(taskSheet);
          tasks = rawTasks.map((row) => ({
            title: row['업무명'] || row['Task'] || '이름모를 업무',
            intensity: parseFloat(row['강도'] || row['Intensity'] || '1.0'),
            startHour: parseFloat(row['시작시간'] || row['StartHour'] || '9.0'),
            endHour: parseFloat(row['종료시간'] || row['EndHour'] || '10.0'),
            setId: row['세트명'] || row['SetId'] || '',
            color: row['색상'] || row['Color'] || 'bg-gray-100 text-gray-800',
          })).filter(t => t.title !== '이름모를 업무'); // Filter out empty rows
        }

        resolve({ profiles, tasks });
      } catch (err) {
        reject(new Error('엑셀 파싱 중 오류가 발생했습니다. 양식을 확인해주세요.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('파일을 읽는 데 실패했습니다.'));
    };

    reader.readAsArrayBuffer(file);
  });
}
