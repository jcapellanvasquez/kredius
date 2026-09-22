package com.kredius.be.exception

class DuplicateImportException(val existingImportId: Long) :
    RuntimeException("A confirmed import already exists with id=$existingImportId")
