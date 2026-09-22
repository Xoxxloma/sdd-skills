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
