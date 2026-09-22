Сервис `svc`, тип `backend`. Прежняя карточка есть. Ниже — ключи по классам, как их дали грепы
`^### ` и `^\| ` по прежней карточке и по черновику. Ключи уже нормализованы.

## ПРЕЖНЯЯ КАРТОЧКА
контракт (38):
  POST /api/v1/ueb/attributes/selected
  GET /api/v1/ueb/attributes/selected
  GET /api/v1/ueb/report/attributes
  GET /api/v1/ueb/report/attributes/{employee}
  POST /api/v1/ueb/report/attributes
  PUT /api/v1/ueb/report/attributes/{attrId}
  DELETE /api/v1/ueb/report/attributes/{attrId}
  POST /api/v1/ueb/form/check
  GET /api/v1/ueb/form/{id}
  POST /api/v1/ueb/form
  DELETE /api/v1/ueb/form/{frmId}
  GET /api/v1/ueb/form
  GET /api/v1/ueb/form/owner
  POST /api/v1/ueb/form/owner
  GET /api/v1/ueb/report
  GET /api/v1/ueb/report/{employee}
  POST /api/v1/ueb/report/{employee}
  POST /api/v1/ueb/report
  POST /api/v1/ueb/report/status
  GET /api/v1/ueb/report/departments
  GET /api/v1/ueb/report/consolidate/bydays
  POST /api/v1/ueb/report/consolidate
  POST /api/v1/ueb/report/consolidate/xlsx
  GET /api/v1/ueb/report/availableDepartments
  GET /api/v1/ueb/approval/requests
  PATCH /api/v1/ueb/approval/{approveId}
  POST /api/v1/ueb/approval/period
  GET /api/v1/ueb/approval/period
  POST /api/v1/ueb/approval/assignment
  GET /api/v1/ueb/approval/assignment/{requestId}
  PATCH /api/v1/ueb/approval/assignment/{requestId}
  POST /api/v1/ueb/upload/cascade
  GET /api/v1/ueb/upload/file-info
  GET /api/v1/ueb/user
  GET /api/v1/ueb/user/owners
  GET /actuator/**
  GET /ueb/swagger-ui.html
  GET /ueb/v3/api-docs

сущности (15):
  Attribute
  Analyst
  Form
  Report
  ReportValue
  PeriodApproveRequest
  AssignmentApproveRequest
  CascadeData
  UploadFileInfo
  EmployeeDepartmentMapping
  Department
  Bank
  Gosb
  adjutant_data_view
  femida_data_view

топики (1):
  публикует auditTopic

задачи (3):
  OldReportsApproveRequestCreator
  FemidaScheduleService
  AdjutantScheduleService

бизнес-правила (0):

роли (8):
  EFS_SVODKA_UEB_ANALYST
  EFS_SECURITYTEAM_SV_UEB_ANALYST
  EFS_SVODKA_UEB_EMPLOYEE
  EFS_SECURITYTEAM_SV_UEB_EMPLOYEE
  EFS_SVODKA_UEB_MANAGER
  EFS_SECURITYTEAM_SV_UEB_MANAGER
  EFS_SVODKA_UEB_ADMIN
  EFS_SECURITYTEAM_SV_UEB_ADMIN

зависит от (4):
  summary-ms-consolidate
  summary-ms-audit
  Профиль сотрудника
  SMTP

кто меня потребляет (6):
  `summary-ui-web` · GET /api/v1/ueb/report
  `summary-ui-web` · POST /api/v1/ueb/report
  `summary-ui-web` · GET /api/v1/ueb/form
  `summary-ui-web` · GET /api/v1/ueb/approval/requests
  `summary-ui-web` · POST /api/v1/ueb/upload/cascade
  `summary-ms-import` · — · выгрузка Каскад

## ЧЕРНОВИК
контракт (38):
  POST /api/v1/ueb/attributes/selected
  GET /api/v1/ueb/attributes/selected
  GET /api/v1/ueb/report/attributes
  GET /api/v1/ueb/report/attributes/{employee}
  POST /api/v1/ueb/report/attributes
  PUT /api/v1/ueb/report/attributes/{attrId}
  DELETE /api/v1/ueb/report/attributes/{attrId}
  POST /api/v1/ueb/form/check
  GET /api/v1/ueb/form/{id}
  POST /api/v1/ueb/form
  DELETE /api/v1/ueb/form/{frmId}
  GET /api/v1/ueb/form
  GET /api/v1/ueb/form/owner
  POST /api/v1/ueb/form/owner
  GET /api/v1/ueb/report
  GET /api/v1/ueb/report/{employee}
  POST /api/v1/ueb/report/{employee}
  POST /api/v1/ueb/report
  POST /api/v1/ueb/report/status
  GET /api/v1/ueb/report/departments
  GET /api/v1/ueb/report/consolidate/bydays
  POST /api/v1/ueb/report/consolidate
  POST /api/v1/ueb/report/consolidate/xlsx
  GET /api/v1/ueb/report/availableDepartments
  GET /api/v1/ueb/approval/requests
  PATCH /api/v1/ueb/approval/{approveId}
  POST /api/v1/ueb/approval/period
  GET /api/v1/ueb/approval/period
  POST /api/v1/ueb/approval/assignment
  GET /api/v1/ueb/approval/assignment/{requestId}
  PATCH /api/v1/ueb/approval/assignment/{requestId}
  POST /api/v1/ueb/upload/cascade
  GET /api/v1/ueb/upload/file-info
  GET /api/v1/ueb/user
  GET /api/v1/ueb/user/owners
  GET /actuator/**
  GET /ueb/swagger-ui.html
  GET /ueb/v3/api-docs

сущности (12):
  Attribute
  Analyst
  Form
  Report
  ReportValue
  PeriodApproveRequest
  AssignmentApproveRequest
  CascadeData
  UploadFileInfo
  EmployeeDepartmentMapping
  adjutant_data_view
  femida_data_view

топики (1):
  публикует auditTopic

задачи (3):
  OldReportsApproveRequestCreator
  FemidaScheduleService
  AdjutantScheduleService

бизнес-правила (11):
  Report — отчёт сотрудника за день
  PeriodApproveRequest — запрос на открытие прошлого периода
  AssignmentApproveRequest — запрос на переназначение владельца форм
  UploadFileInfo — журнал загрузок CSV-файлов Каскад
  сообщение «согласование отчёта АС Сводка»
  сообщение «запрос на открытие периода»
  сообщение «событие аудита»
  ограничение «редактирование отчёта вне текущей недели»
  ограничение «повторный запрос на открытие периода»
  ограничение «даты отчёта вне одной недели»
  ограничение «загрузка файла, не являющегося выгрузкой Каскад»

роли (8):
  EFS_SVODKA_UEB_ANALYST
  EFS_SECURITYTEAM_SV_UEB_ANALYST
  EFS_SVODKA_UEB_EMPLOYEE
  EFS_SECURITYTEAM_SV_UEB_EMPLOYEE
  EFS_SVODKA_UEB_MANAGER
  EFS_SECURITYTEAM_SV_UEB_MANAGER
  EFS_SVODKA_UEB_ADMIN
  EFS_SECURITYTEAM_SV_UEB_ADMIN

зависит от (4):
  summary-ms-consolidate
  summary-ms-audit
  Профиль сотрудника
  SMTP

кто меня потребляет (0):
