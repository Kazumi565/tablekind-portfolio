"""Export a compact backend verification record without environment values or tokens."""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
reports = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'backend/target/surefire-reports'
environment = sys.argv[2] if len(sys.argv) > 2 else 'unspecified'
suites = []
for file in sorted(reports.glob('TEST-*.xml')):
    suite = ET.parse(file).getroot()
    suites.append({
        'name': suite.attrib['name'],
        **{key: int(suite.attrib.get(key, 0)) for key in ('tests', 'failures', 'errors', 'skipped')},
        'cases': [{
            'name': case.attrib['name'],
            'result': 'skipped' if case.find('skipped') is not None else 'failed' if case.find('failure') is not None or case.find('error') is not None else 'passed',
        } for case in suite.findall('testcase')],
    })
if not suites:
    raise SystemExit('No Surefire reports found.')
totals = {key: sum(s[key] for s in suites) for key in ('tests', 'failures', 'errors', 'skipped')}
result = {
    'recordedAt': datetime.now(timezone.utc).isoformat(),
    'environment': environment,
    'status': 'passed-with-skips' if not totals['failures'] and not totals['errors'] and totals['skipped'] else 'passed' if not totals['failures'] and not totals['errors'] else 'failed',
    **totals,
    'passed': totals['tests']-totals['failures']-totals['errors']-totals['skipped'],
    'suites': suites,
}
destination = root / 'docs/verification/backend-results.json'
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
print(json.dumps({key: value for key, value in result.items() if key != 'suites'}, indent=2))
