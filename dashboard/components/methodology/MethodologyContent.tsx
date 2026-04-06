import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { gradeColors } from "@/lib/colors";
import type { Grade } from "@/lib/types";

const grades: { grade: Grade; label: string; definition: string }[] = [
  {
    grade: "1",
    label: "Совпадение",
    definition:
      "Одинаковый клинический смысл. Предварительное и итоговое описания несут одинаковую диагностическую информацию, даже если сформулированы по-разному.",
  },
  {
    grade: "2a",
    label: "Стилистическое расхождение",
    definition:
      "Различие только в формулировке или оформлении. Клинический смысл не изменён. Примеры: добавлены рекомендательные фразы, предложения перефразированы, использована другая терминология для того же явления.",
  },
  {
    grade: "2b",
    label: "Минимальное клиническое расхождение",
    definition:
      "Находка добавлена или скорректирована, но тактика ведения не изменяется. Клинический смысл незначительно отличается, но не влияет на лечение. Примеры: другие размеры, добавленная деталь к известной находке.",
  },
  {
    grade: "3",
    label: "Значимый пропуск",
    definition:
      "Пропущена находка, меняющая тактику ведения. Врач не описал находку, которую добавил валидатор, и эта находка изменила бы рекомендованный план обследования или наблюдения.",
  },
  {
    grade: "4",
    label: "Гипердиагностика",
    definition:
      "Ложная находка, приводящая к ненужному обследованию. Врач описал находку или рекомендацию, которую валидатор не подтвердил — это могло привести к излишним процедурам.",
  },
];

export function MethodologyContent() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Методология</h1>
        <p className="mt-1 text-muted-foreground">
          Адаптированная система оценки RADPEER для контроля качества рентгенологических описаний
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Общее описание</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <p>
            Дашборд измеряет качество рентгенологических описаний путём сравнения
            первичных протоколов врача с итоговыми протоколами, проверенными валидатором.
            Анализ использует адаптированную версию системы{" "}
            <strong>RADPEER</strong>, применяемую на уровне{" "}
            <strong>отдельных находок</strong>, а не всего протокола целиком.
          </p>
          <p>
            Каждое рентгенологическое описание разбивается на атомарные находки
            (например, лёгочные узелки, коронарный кальциноз, лимфаденопатия).
            Каждая находка сравнивается между черновиком врача и итоговым
            протоколом валидатора, и ей присваивается оценка от 1 до 4.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Шкала оценок</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Оценка</TableHead>
                <TableHead className="w-[220px]">Название</TableHead>
                <TableHead>Определение</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map(({ grade, label, definition }) => {
                const colors = gradeColors[grade];
                return (
                  <TableRow key={grade}>
                    <TableCell>
                      <Badge className={colors.badge}>{grade}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{label}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {definition}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ключевые метрики</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <div>
            <h3 className="font-semibold">Конкордантность (Grade 1)</h3>
            <p className="text-muted-foreground">
              Доля находок с оценкой 1 (точное совпадение). Показывает, как часто
              предварительные описания врача полностью совпадают с итоговым
              протоколом по клиническому смыслу.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Клиническая конкордантность (Grade 1 + 2a)</h3>
            <p className="text-muted-foreground">
              Доля находок с оценкой 1 или 2a (совпадение + стилистические различия).
              Это основная метрика качества — охватывает все находки, где клинический
              смысл сохранён, независимо от различий в формулировке.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Значимые расхождения (Grade 3+)</h3>
            <p className="text-muted-foreground">
              Доля находок с оценкой 3 или 4. Представляют клинически значимые
              различия, которые могут повлиять на тактику ведения пациента.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Дизайн исследования</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <p>
            <strong>Модальность:</strong> КТ органов грудной клетки (без контраста)
          </p>
          <p>
            <strong>Рабочий процесс:</strong> Врачи составляют предварительные описания.
            Валидаторы проверяют и корректируют эти описания. Каждая находка сравнивается
            между черновиком врача и исправленной версией валидатора, и ей присваивается
            оценка RADPEER от 1 до 4.
          </p>
          <p>
            <strong>Ключевая метрика:</strong> Клиническая конкордантность (Grade 1 + 2a)
            является основным показателем качества. Оценки 3 и 4 представляют клинически
            значимые расхождения, требующие внимания.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
