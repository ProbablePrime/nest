import 'reflect-metadata';
import { Controller } from '../../common/interfaces/controller.interface';
import { ExceptionsHandler } from '../exceptions/exceptions-handler';
import { EXCEPTION_FILTERS_METADATA, FILTER_CATCH_EXCEPTIONS } from '../../common/constants';
import { isEmpty, isFunction } from '../../common/utils/shared.utils';
import { Metatype } from '../../common/interfaces/index';
import { ExceptionFilterMetadata } from '../../common/interfaces/exception-filter-metadata.interface';
import { NestContainer } from '../injector/container';
import { UnkownModuleException } from '../../errors/exceptions/unkown-module.exception';
import { ExceptionFilter } from '../../common/interfaces/exception-filter.interface';

export class RouterExceptionFilters {
    constructor(private container: NestContainer) {}

    public create(instance: Controller, moduleName: string): ExceptionsHandler {
        const exceptionHandler = new ExceptionsHandler();
        const filters = this.reflectExceptionFilters(instance);
        if (isEmpty(filters)) {
            return exceptionHandler;
        }

        const filtersHooks = this.resolveFiltersMetatypes(filters, moduleName);
        exceptionHandler.setCustomFilters(filtersHooks);
        return exceptionHandler;
    }

    public reflectExceptionFilters(instance: Controller): Metatype<any>[] {
        const prototype = Object.getPrototypeOf(instance);
        return Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, prototype.constructor) || [];
    }

    public resolveFiltersMetatypes(filters: Metatype<any>[], moduleName: string): ExceptionFilterMetadata[] {
        return filters.filter(metatype => isFunction(metatype))
                .map(metatype => ({
                    instance: this.findExceptionsFilterInstance(metatype, moduleName),
                    metatype,
                }))
                .filter(({ instance }) => instance.catch && isFunction(instance.catch))
                .map(({ instance, metatype }) => ({
                    func: instance.catch.bind(instance),
                    exceptionMetatypes: this.reflectCatchExceptions(metatype),
                }));
    }

    public findExceptionsFilterInstance(metatype: Metatype<any>, moduleName: string): ExceptionFilter {
        const modules = this.container.getModules();
        if (!modules.has(moduleName)) {
            throw new UnkownModuleException();
        }
        const { components } = modules.get(moduleName);
        const { instance } =  components.get(metatype.name);
        return instance as ExceptionFilter;
    }

    public reflectCatchExceptions(metatype: Metatype<Controller>): Metatype<any>[] {
        return Reflect.getMetadata(FILTER_CATCH_EXCEPTIONS, metatype) || [];
    }
}