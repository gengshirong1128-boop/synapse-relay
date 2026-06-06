from __future__ import annotations

from abc import ABC, abstractmethod

from backend.schemas import ExecutionPackage


class BaseExporter(ABC):
    executor_type: str = "generic"

    @abstractmethod
    def build_prompt(self, package: ExecutionPackage) -> str:
        raise NotImplementedError

    def export(self, package: ExecutionPackage) -> ExecutionPackage:
        package.generated_prompt = self.build_prompt(package)
        return package
